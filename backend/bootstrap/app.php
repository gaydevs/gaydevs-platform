<?php

use App\Exceptions\OperationalException;
use App\Http\Middleware\AssignRequestId;
use App\Http\Middleware\ExpireAuthenticatedSessions;
use App\Http\Middleware\TrackVisitor;
use App\Support\RequestCorrelation;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        apiPrefix: '',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->trimStrings(['label', 'options.*']);
        $middleware->prependToGroup('api', AssignRequestId::class);
        $middleware->appendToGroup('api', ExpireAuthenticatedSessions::class);
        $middleware->appendToGroup('api', TrackVisitor::class);
        $middleware->alias([
            'track.visitor' => TrackVisitor::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request, Throwable $exception): bool => $request->is('applications/*', 'admin/applications*') || $request->expectsJson());
        $exceptions->dontFlash(['email', 'code', 'turnstile_token', 'first_name', 'last_name', 'whatsapp', 'linkedin', 'github', 'instagram', 'referral_source', 'consents', 'admin_notes']);
        $exceptions->report(function (Throwable $exception) {
            if (request()->is('applications/*', 'admin/applications*')) {
                Log::channel('operational')->error('applications.unhandled_exception', [
                    'request_id' => RequestCorrelation::id(request()),
                    'exception_type' => $exception::class,
                ]);

                return false;
            }
        });
        $exceptions->report(function (Throwable $exception): void {
            $request = request();
            $isServerError = ! ($exception instanceof HttpExceptionInterface)
                || $exception->getStatusCode() >= Response::HTTP_INTERNAL_SERVER_ERROR;

            if (! $request->expectsJson() || ! $isServerError || $exception instanceof OperationalException) {
                return;
            }

            Log::channel('operational')->error('api.unhandled_exception', [
                'request_id' => RequestCorrelation::id($request),
                'method' => $request->method(),
                'path' => $request->path(),
                'exception' => $exception,
            ]);
        });
        $exceptions->render(function (AuthenticationException $exception, Request $request) {
            if ($request->is('auth/*') || $request->expectsJson()) {
                return response()->json(['message' => 'Não autenticado.'], 401);
            }
        });
        $exceptions->respond(function (Response $response): Response {
            $requestId = request()->attributes->get(RequestCorrelation::ATTRIBUTE);
            if ($response->getStatusCode() >= Response::HTTP_INTERNAL_SERVER_ERROR
                && (request()->expectsJson() || request()->is('applications/*', 'admin/applications*'))
                && is_string($requestId)) {
                $response = response()->json([
                    'message' => 'Erro interno do servidor.',
                    'reference' => $requestId,
                ], $response->getStatusCode());
            }

            if (is_string($requestId)) {
                $response->headers->set(RequestCorrelation::HEADER, $requestId);
            }

            if (request()->is('applications/*', 'admin/applications*')) {
                if ($response instanceof JsonResponse && $response->getStatusCode() >= 400) {
                    $payload = $response->getData(true);
                    foreach (['exception', 'file', 'line', 'trace'] as $key) {
                        unset($payload[$key]);
                    }
                    $response->setData($payload);
                }
                $response->headers->set('Cache-Control', 'no-store, private');
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
        $schedule->command('smtp:keepalive')
            ->name('smtp:keepalive')
            ->daily()
            ->withoutOverlapping();
    })
    ->create();
