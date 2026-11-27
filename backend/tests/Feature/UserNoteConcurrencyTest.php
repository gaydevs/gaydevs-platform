<?php

use App\Enums\MemberType;
use App\Http\Controllers\UserNoteController;
use App\Models\User;
use App\Models\UserNote;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Concurrency;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

function competingNoteWrite(array $connection, string $authorId, string $memberId, string $content, string $barrier): Closure
{
    return static function () use ($connection, $authorId, $memberId, $content, $barrier): array {
        config(['database.connections.note_race' => $connection, 'database.default' => 'note_race']);
        $author = User::query()->findOrFail($authorId);
        $request = Request::create('/notes/'.$memberId, 'PUT', [], [], [], ['HTTP_X_NOTES_ACTOR' => $authorId, 'HTTP_ACCEPT' => 'application/json']);
        $request->setUserResolver(fn () => $author);
        $controller = app(UserNoteController::class);
        $expected = $controller->show($request, $memberId)->getData(true)['version'];
        // Both independent processes must read the same revision before either writes.
        touch($barrier.'/'.$content);
        $deadline = microtime(true) + 10;
        while (count(glob($barrier.'/*')) < 2) {
            if (microtime(true) >= $deadline) {
                throw new RuntimeException('Timed out waiting for competing note writer.');
            }
            usleep(10000);
            clearstatcache();
        }
        $request->merge(['content' => $content, 'expected_version' => $expected]);
        $response = $controller->update($request, $memberId);

        return ['status' => $response->getStatusCode(), 'expected' => $expected, 'body' => $response->getData(true), 'content' => $content];
    };
}

test('independent writers compete atomically for the same note revision', function (bool $existing) {
    $default = DB::getDefaultConnection();
    $connection = config('database.connections.'.$default);
    $driver = $connection['driver'];
    if (! in_array($driver, ['sqlite', 'mysql'], true) || ! app()->environment('testing')) {
        throw new RuntimeException('Note concurrency tests require a disposable SQLite/MySQL test environment.');
    }
    $directory = sys_get_temp_dir().'/note-race-'.Str::uuid();
    File::makeDirectory($directory);
    File::makeDirectory($directory.'/barrier');
    $author = null;
    $member = null;
    try {
        if ($driver === 'sqlite') {
            $connection['database'] = $directory.'/notes.sqlite';
            touch($connection['database']);
            $connection['url'] = null;
            $connection['busy_timeout'] = 10000;
        } elseif (! preg_match('/^testing(?:_test_\d+)?$/', $connection['database']) || ! in_array($connection['host'], ['127.0.0.1', 'localhost', '::1'], true) || ! empty($connection['url'])) {
            throw new RuntimeException('Refusing to use a non-test MySQL database.');
        }
        config(['database.connections.note_race' => $connection, 'database.default' => 'note_race']);
        // SQLite needs a separate file, not the per-process :memory: database.
        if ($driver === 'sqlite') {
            Artisan::call('migrate', ['--database' => 'note_race', '--force' => true]);
        }
        $author = User::factory()->create(['member_type' => MemberType::ADMIN]);
        $member = User::factory()->create();
        if ($existing) {
            UserNote::query()->create(['author_id' => $author->id, 'user_id' => $member->id, 'content' => 'A']);
        }
        $results = Concurrency::driver('process')->run([
            competingNoteWrite($connection, $author->id, $member->id, 'B', $directory.'/barrier'),
            competingNoteWrite($connection, $author->id, $member->id, 'C', $directory.'/barrier'),
        ], timeout: 30);
        usort($results, fn ($a, $b) => $a['status'] <=> $b['status']);
        [$winner, $loser] = $results;
        $version = $existing ? 2 : 1;
        expect([$winner['status'], $loser['status']])->toBe([200, 409])
            ->and([$winner['expected'], $loser['expected']])->toBe([$version - 1, $version - 1])
            ->and($winner['body']['version'])->toBe($version)
            ->and($loser['body']['reason'])->toBe('note_version_conflict')
            ->and($loser['body']['note']['content'])->toBe($winner['content'])
            ->and($loser['body']['note']['version'])->toBe($version);
        $note = UserNote::query()->where('author_id', $author->id)->where('user_id', $member->id)->sole();
        expect($note->content)->toBe($winner['content'])->and($note->version)->toBe($version);
    } finally {
        // Never truncate unrelated fixtures or touch a persistent database.
        $author?->delete();
        $member?->delete();
        DB::purge('note_race');
        config(['database.default' => $default]);
        File::deleteDirectory($directory);
    }
})->with([false, true]);
