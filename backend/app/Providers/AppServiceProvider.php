<?php

namespace App\Providers;

use App\Services\GeoIp\GeoIpDatabaseDownloader;
use App\Services\GeoIp\GeoIpDatabaseValidator;
use App\Services\GeoIp\GeoIpLookup;
use App\Services\GeoIp\LocalGeoIpLookup;
use App\Services\GeoIp\MaxMindGeoIpDatabaseDownloader;
use App\Services\GeoIp\MaxMindGeoIpDatabaseValidator;
use Illuminate\Console\Events\ScheduledTaskFailed;
use Illuminate\Console\Events\ScheduledTaskFinished;
use Illuminate\Console\Events\ScheduledTaskSkipped;
use Illuminate\Console\Events\ScheduledTaskStarting;
use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(GeoIpLookup::class, LocalGeoIpLookup::class);
        $this->app->bind(GeoIpDatabaseDownloader::class, MaxMindGeoIpDatabaseDownloader::class);
        $this->app->bind(GeoIpDatabaseValidator::class, MaxMindGeoIpDatabaseValidator::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(Dispatcher $events): void
    {
        $events->listen(
            ScheduledTaskStarting::class,
            fn (ScheduledTaskStarting $event) => Log::channel('scheduler')->info(
                'scheduled_task.started',
                $this->scheduledTaskContext($event->task),
            ),
        );

        $events->listen(
            ScheduledTaskFinished::class,
            fn (ScheduledTaskFinished $event) => Log::channel('scheduler')->info(
                'scheduled_task.succeeded',
                [
                    ...$this->scheduledTaskContext($event->task),
                    'runtime_seconds' => round($event->runtime, 4),
                    'exit_code' => $event->task->exitCode,
                ],
            ),
        );

        $events->listen(
            ScheduledTaskFailed::class,
            fn (ScheduledTaskFailed $event) => Log::channel('scheduler')->error(
                'scheduled_task.failed',
                [
                    ...$this->scheduledTaskContext($event->task),
                    'runtime_seconds' => $event->runtime === null ? null : round($event->runtime, 4),
                    'exception' => $event->exception,
                ],
            ),
        );

        $events->listen(
            ScheduledTaskSkipped::class,
            fn (ScheduledTaskSkipped $event) => Log::channel('scheduler')->info(
                'scheduled_task.skipped',
                [
                    ...$this->scheduledTaskContext($event->task),
                    'reason' => $event->task->skippedBecauseOverlapping ? 'overlapping' : 'condition',
                ],
            ),
        );
    }

    /** @return array{task: string, expression: string, timezone: string|null} */
    private function scheduledTaskContext(ScheduledEvent $task): array
    {
        return [
            'task' => $task->description ?: 'unnamed',
            'expression' => $task->expression,
            'timezone' => $task->timezone,
        ];
    }
}
