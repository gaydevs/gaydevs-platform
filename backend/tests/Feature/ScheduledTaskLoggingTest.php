<?php

use Illuminate\Console\Events\ScheduledTaskFailed;
use Illuminate\Console\Events\ScheduledTaskFinished;
use Illuminate\Console\Events\ScheduledTaskSkipped;
use Illuminate\Console\Events\ScheduledTaskStarting;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Log;
use Psr\Log\LoggerInterface;

test('scheduled task lifecycle is written to the dedicated log', function () {
    $logger = Mockery::mock(LoggerInterface::class);
    $logger->shouldReceive('info')->times(3);
    $logger->shouldReceive('error')->once();

    Log::shouldReceive('channel')
        ->times(4)
        ->with('scheduler')
        ->andReturn($logger);

    $task = app(Schedule::class)
        ->command('visitors:anonymize-ips')
        ->name('visitors:anonymize-ips');

    event(new ScheduledTaskStarting($task));
    event(new ScheduledTaskFinished($task, 0.25));
    event(new ScheduledTaskFailed($task, new RuntimeException('expected test failure'), 0.5));
    event(new ScheduledTaskSkipped($task));
});

test('scheduler log uses daily rotation and configurable retention', function () {
    expect(config('logging.channels.scheduler.driver'))->toBe('daily')
        ->and(config('logging.channels.scheduler.days'))->toBe(30);
});
