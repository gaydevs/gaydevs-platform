<?php

use App\Enums\ApplicantStatus;
use App\Enums\MemberType;
use App\Enums\OtpRequestStatus;
use App\Models\Applicant;
use App\Models\OtpRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\Process\Process;

test('independent workers serialize start proof submission and approval for the same email', function () {
    if (! function_exists('proc_open')) {
        $this->markTestSkipped('Independent processes require proc_open.');
    }

    $directory = sys_get_temp_dir().'/gdev-applications-'.bin2hex(random_bytes(8));
    mkdir($directory, 0700);
    $database = $directory.'/test.sqlite';
    touch($database);
    $original = DB::getDefaultConnection();
    $connection = 'application_concurrency';
    config(["database.connections.{$connection}" => array_merge(config('database.connections.sqlite'), [
        'database' => $database,
        'foreign_key_constraints' => true,
    ])]);
    DB::setDefaultConnection($connection);
    Schema::clearResolvedInstance('db.schema');

    $environment = [
        'APP_ENV' => 'testing',
        'APP_KEY' => 'base64:'.base64_encode(random_bytes(32)),
        'DB_CONNECTION' => 'sqlite',
        'DB_DATABASE' => $database,
        'DB_URL' => '',
        'DB_FOREIGN_KEYS' => 'true',
        'CACHE_STORE' => 'database',
        'DB_CACHE_CONNECTION' => 'sqlite',
        'DB_CACHE_LOCK_CONNECTION' => 'sqlite',
        'CACHE_PREFIX' => 'application-concurrency-test',
        'MAIL_MAILER' => 'array',
    ];

    $runPair = function (string $operation, string $subject, string $actor = '') use ($directory, $environment): array {
        $go = $directory.'/'.$operation.'-go';
        $workers = [];
        $ready = [];

        try {
            foreach ([0, 1] as $index) {
                $ready[$index] = $directory.'/'.$operation.'-ready-'.$index;
                $workers[$index] = new Process([
                    PHP_BINARY, base_path('tests/Fixtures/application-lifecycle-worker.php'),
                    $operation, $subject, $actor, $ready[$index], $go,
                ], base_path(), $environment, timeout: 30);
                $workers[$index]->start();
            }

            $deadline = microtime(true) + 15;
            while (! is_file($ready[0]) || ! is_file($ready[1])) {
                if (microtime(true) > $deadline || ! $workers[0]->isRunning() || ! $workers[1]->isRunning()) {
                    throw new RuntimeException('Workers did not reach the concurrency barrier.');
                }
                usleep(10000);
            }
            touch($go);

            return array_map(function (Process $process): array {
                $process->wait();
                if (! $process->isSuccessful()) {
                    throw new RuntimeException($process->getErrorOutput().$process->getOutput());
                }

                return json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR);
            }, $workers);
        } finally {
            foreach ($workers as $worker) {
                if ($worker->isRunning()) {
                    $worker->stop();
                }
            }
        }
    };

    try {
        foreach (glob(database_path('migrations/*.php')) as $path) {
            (require $path)->up();
        }

        $starts = $runPair('start', 'concurrent@example.com');
        expect($starts[0]['id'])->toBe($starts[1]['id'])
            ->and(Applicant::count())->toBe(1);
        $applicant = Applicant::findOrFail($starts[0]['id']);

        $proof = OtpRequest::factory()->forApplicant($applicant)->create([
            'status' => OtpRequestStatus::Used,
            'accepted_at' => now(),
        ]);
        $confirmations = $runPair('confirm', $proof->id);
        expect(collect($confirmations)->where('conflict', true)->count())->toBe(1)
            ->and($applicant->refresh()->status)->toBe(ApplicantStatus::Draft)
            ->and($applicant->events()->where('event_type', 'email_verified')->count())->toBe(1);

        $applicant->fill(['first_name' => 'Test', 'last_name' => 'Concurrent'])->save();
        $submissions = $runPair('submit', $applicant->id, (string) $applicant->revision);
        expect($submissions[0]['id'])->toBe($submissions[1]['id'])
            ->and($applicant->refresh()->status)->toBe(ApplicantStatus::Pending)
            ->and($applicant->events()->where('event_type', 'test_intent')->count())->toBe(1);

        $reviewer = User::factory()->create(['member_type' => MemberType::ADMIN]);
        $approvals = $runPair('approve', $applicant->id, $reviewer->id);
        expect($approvals[0]['id'])->toBe($approvals[1]['id'])
            ->and(User::where('applicant_id', $applicant->id)->count())->toBe(1)
            ->and($applicant->refresh()->status)->toBe(ApplicantStatus::Approved)
            ->and($applicant->events()->where('event_type', 'approved')->count())->toBe(1);
    } finally {
        DB::setDefaultConnection($original);
        Schema::clearResolvedInstance('db.schema');
        DB::purge($connection);
        File::deleteDirectory($directory);
    }
});
