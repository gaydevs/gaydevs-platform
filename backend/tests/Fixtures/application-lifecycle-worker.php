<?php

use App\Exceptions\RateLimitExceededException;
use App\Models\Applicant;
use App\Models\OtpRequest;
use App\Models\User;
use App\Services\ApplicantLifecycle;
use App\Services\ApplicationRateLimiter;
use Illuminate\Contracts\Console\Kernel;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

$testDatabase = getenv('DB_DATABASE');
if (getenv('APP_ENV') !== 'testing' || getenv('DB_CONNECTION') !== 'sqlite'
    || ! is_string($testDatabase) || basename($testDatabase) !== 'test.sqlite'
    || ! str_starts_with(basename(dirname($testDatabase)), 'gdev-applications-')) {
    throw new RuntimeException('Worker requires a disposable SQLite test database.');
}

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

[, $operation, $subject, $actor, $ready, $go] = $argv;
touch($ready);
$deadline = microtime(true) + 15;
while (! is_file($go)) {
    if (microtime(true) > $deadline) {
        throw new RuntimeException('Concurrency test barrier timed out.');
    }
    usleep(10000);
}

$lifecycle = $app->make(ApplicantLifecycle::class);

try {
    if ($operation === 'rate-limit') {
        $app->make(ApplicationRateLimiter::class)->sendOtp($subject);
        echo json_encode(['reserved' => true], JSON_THROW_ON_ERROR);

        return;
    }
    $result = match ($operation) {
        'start' => $lifecycle->start($subject),
        'confirm' => $lifecycle->confirmEmail(OtpRequest::findOrFail($subject)),
        'submit' => $lifecycle->submit(
            Applicant::findOrFail($subject),
            (int) $actor,
            fn () => null,
            fn (Applicant $applicant) => $applicant->events()->create([
                'event_key' => 'test-notification-intent',
                'event_type' => 'test_intent',
                'occurred_at' => now(),
            ]),
        ),
        'approve' => $lifecycle->approve(Applicant::findOrFail($subject), User::findOrFail($actor)),
        default => throw new RuntimeException('Unsupported test operation.'),
    };
    echo json_encode(['id' => $result->id], JSON_THROW_ON_ERROR);
} catch (RateLimitExceededException) {
    echo json_encode(['limited' => true], JSON_THROW_ON_ERROR);
} catch (ConflictHttpException) {
    echo json_encode(['conflict' => true], JSON_THROW_ON_ERROR);
}
