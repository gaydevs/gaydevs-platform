<?php

namespace App\Http\Middleware;

use App\Enums\ApplicantStatus;
use App\Services\ApplicantSessions;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class EnsureApplicantSession
{
    public function __construct(private ApplicantSessions $sessions) {}

    public function handle(Request $request, Closure $next, string $mode = 'read'): Response
    {
        if (Auth::guard('web')->check() || $request->bearerToken() !== null) {
            throw new HttpException(401, 'Sessão de candidato necessária.');
        }
        $applicant = $this->sessions->current($request);
        if ($applicant === null) {
            throw new HttpException(401, 'Sessão de candidato necessária.');
        }
        if ($mode === 'write' && $applicant->status !== ApplicantStatus::Draft) {
            throw new ConflictHttpException('Candidatura não editável.');
        }
        $request->attributes->set('applicant', $applicant);

        return $next($request);
    }
}
