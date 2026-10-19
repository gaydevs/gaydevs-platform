<?php

use App\Http\Middleware\TrackVisitor;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        apiPrefix: '',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->appendToGroup('api', TrackVisitor::class);
        $middleware->alias([
            'track.visitor' => TrackVisitor::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (AuthenticationException $exception, Request $request) {
            if ($request->is('auth/*') || $request->expectsJson()) {
                return response()->json(['message' => 'Não autenticado.'], 401);
            }
        });
    })
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->command('visitors:anonymize-ips')
            ->name('visitors:anonymize-ips')
            ->dailyAt('03:00')
            ->withoutOverlapping();
        $schedule->command('geoip:update')
            ->name('geoip:update')
            ->dailyAt('04:00')
            ->when(fn (): bool => (bool) config('geoip.update_enabled'))
            ->withoutOverlapping();
    })
    ->create();
