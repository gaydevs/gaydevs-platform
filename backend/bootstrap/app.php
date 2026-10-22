<?php

use App\Http\Middleware\AssignRequestId;
use App\Http\Middleware\ExpireAuthenticatedSessions;
use App\Http\Middleware\TrackVisitor;
use App\Support\RequestCorrelation;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        apiPrefix: '',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->prependToGroup('api', AssignRequestId::class);
        $middleware->appendToGroup('api', ExpireAuthenticatedSessions::class);
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
        $exceptions->respond(function (Response $response): Response {
            $requestId = request()->attributes->get(RequestCorrelation::ATTRIBUTE);
            if (is_string($requestId)) {
                $response->headers->set(RequestCorrelation::HEADER, $requestId);
            }

            return $response;
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
