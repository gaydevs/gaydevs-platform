<?php

namespace App\Http\Controllers;

use App\Enums\ApplicantStatus;
use App\Models\Applicant;
use App\Services\ApplicantLifecycle;
use App\Services\ApplicantSessions;
use App\Services\ApplicationAvailability;
use App\Services\ApplicationData;
use App\Services\ApplicationNotifications;
use App\Services\ApplicationProfileVerifier;
use App\Services\ApplicationRateLimiter;
use App\Services\ApplicationTerms;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class ApplicationController extends Controller
{
    public function __construct(private ApplicationData $data, private ApplicationTerms $terms,
        private ApplicantLifecycle $lifecycle, private ApplicantSessions $sessions,
        private ApplicationAvailability $availability) {}

    public function terms(): Response
    {
        return response()->json($this->terms->publicData())->header('Cache-Control', 'no-store, private');
    }

    public function step(Request $request, string $step, ApplicationProfileVerifier $profiles, ApplicationRateLimiter $limits): Response
    {
        $this->availability->ensure();
        $applicant = $request->attributes->get('applicant');
        $index = array_search($step, ApplicationData::STEPS, true);
        abort_if($index === false || $index >= 4, 404);
        if ($step === 'profiles') {
            $limits->links($request->ip());
        }
        $revision = (int) $request->validate(['revision' => ['required', 'integer', 'min:0']])['revision'];
        $acceptances = $request->input('consents', []);
        if (! is_array($acceptances)) {
            throw ValidationException::withMessages(['consents' => 'Informe os aceites.']);
        }
        $this->ensureStep($applicant, $index, $revision);
        $values = match ($step) {
            'identification' => $this->data->identification($request->only(['first_name', 'last_name', 'whatsapp'])),
            'profiles' => $this->data->profiles($request->only(['linkedin', 'github', 'instagram', 'github_skip_confirmed'])),
            'origin' => $this->data->origin($request->only(['referral_source', 'collaboration_interest'])),
            'terms' => [],
        };
        $checks = [];
        $acceptedKeys = [];
        if ($step === 'profiles') {
            // Explicit permission precedes even a syntactically valid external lookup.
            $this->terms->validateAcceptance($acceptances, ['external_profiles']);
            $acceptedKeys = ['external_profiles'];
            // Persist the authorization before the outbound lookup, including
            // when an unavailable profile prevents completion of this step.
            $this->lifecycle->withEmailLock($applicant->email, fn () => DB::transaction(function () use ($request, $applicant, $index, $revision): void {
                $current = Applicant::query()->lockForUpdate()->findOrFail($applicant->id);
                $this->sessions->assertCurrent($request, $current);
                $this->ensureStep($current, $index, $revision);
                $this->terms->record($current, ['external_profiles']);
            }, 3));
            foreach ($values as $network => $url) {
                if ($url !== null) {
                    $checks[$network] = $profiles->check($network, $url);
                    if ($checks[$network] === 'invalid') {
                        throw ValidationException::withMessages([$network => 'Perfil não encontrado. Confira o identificador.']);
                    }
                }
            }
            $values['github_skip_confirmed_at'] = $values['github'] === null ? now() : null;
        } elseif ($step === 'terms') {
            $acceptedKeys = array_keys($this->terms->texts());
            $this->terms->validateAcceptance($acceptances, $acceptedKeys);
        }
        $current = $this->lifecycle->withEmailLock($applicant->email, fn () => DB::transaction(function () use ($request, $applicant, $index, $step, $revision, $values, $acceptedKeys): Applicant {
            $current = Applicant::query()->lockForUpdate()->findOrFail($applicant->id);
            $this->sessions->assertCurrent($request, $current);
            $this->ensureStep($current, $index, $revision);
            $next = max((int) array_search($current->current_step, ApplicationData::STEPS, true), $index + 1);
            $current->forceFill([...$values, 'current_step' => ApplicationData::STEPS[$next], 'revision' => $current->revision + 1])->save();
            $this->terms->record($current, $acceptedKeys);
            $current->events()->create([
                'event_key' => 'step:'.$step.':'.$current->revision,
                'event_type' => 'step_completed',
                'step' => $step,
                'occurred_at' => now(),
            ]);

            return $current;
        }, 3));

        return response()->json([
            'status' => $current->status->value,
            'current_step' => $current->current_step,
            'revision' => $current->revision,
            'fields' => $this->data->fields($current),
            'profile_checks' => $checks,
        ]);
    }

    public function submit(Request $request, ApplicationNotifications $notifications): Response
    {
        $this->availability->ensure();
        $applicant = $request->attributes->get('applicant');
        $revision = (int) $request->validate(['revision' => ['required', 'integer', 'min:0']])['revision'];
        $current = $this->lifecycle->submit($applicant, $revision,
            fn (Applicant $a) => $this->data->validateSubmission($a),
            fn (Applicant $a) => $notifications->enqueue($a),
            fn (Applicant $a) => $this->sessions->assertCurrent($request, $a));

        return response()->json([
            'status' => $current->status->value,
            'current_step' => $current->current_step,
            'revision' => $current->revision,
            'whatsapp_url' => $this->availability->whatsapp(),
        ]);
    }

    private function ensureStep(Applicant $applicant, int $index, int $revision): void
    {
        $current = array_search($applicant->current_step, ApplicationData::STEPS, true);
        if ($applicant->status !== ApplicantStatus::Draft || $applicant->revision !== $revision || $current === false || $index > $current) {
            throw new ConflictHttpException('Etapa ou revisão incompatível. Atualize a candidatura.');
        }
    }
}
