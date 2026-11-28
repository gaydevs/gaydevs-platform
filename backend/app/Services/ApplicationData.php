<?php

namespace App\Services;

use App\Models\Applicant;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class ApplicationData
{
    public const STEPS = ['identification', 'profiles', 'origin', 'terms', 'ready', 'submitted'];

    public function __construct(private ApplicationProfileUrl $urls, private ApplicationTerms $terms) {}

    public function identification(array $data): array
    {
        $values = Validator::make($data, [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'whatsapp' => ['required', 'string', 'max:40'],
        ])->validate();
        $phone = trim($values['whatsapp']);
        if (! preg_match('/^\+?[0-9 ().-]+$/D', $phone)) {
            throw ValidationException::withMessages(['whatsapp' => 'Informe um telefone com DDD ou código internacional.']);
        }
        $digits = preg_replace('/\D/', '', $phone);
        if (! str_starts_with($phone, '+')) {
            if (in_array(strlen($digits), [10, 11], true)) {
                $digits = '55'.$digits;
            } elseif (! str_starts_with($digits, '55') || ! in_array(strlen($digits), [12, 13], true)) {
                throw ValidationException::withMessages(['whatsapp' => 'Use DDD brasileiro ou prefixo internacional +.']);
            }
        }
        if (! preg_match('/^[1-9][0-9]{7,14}$/D', $digits)) {
            throw ValidationException::withMessages(['whatsapp' => 'Informe um telefone válido.']);
        }
        $values['whatsapp'] = '+'.$digits;

        return $values;
    }

    public function profiles(array $data): array
    {
        $values = Validator::make($data, [
            'linkedin' => ['required', 'string', 'max:2048'],
            'github' => ['nullable', 'string', 'max:2048'],
            'instagram' => ['nullable', 'string', 'max:2048'],
            'github_skip_confirmed' => ['sometimes', 'boolean'],
        ])->validate();
        $result = [];
        foreach (['linkedin', 'github', 'instagram'] as $network) {
            $result[$network] = $this->urls->normalize($network, $values[$network] ?? null);
        }
        if ($result['linkedin'] === null) {
            throw ValidationException::withMessages(['linkedin' => 'LinkedIn é obrigatório.']);
        }
        if ($result['github'] === null && ! ($values['github_skip_confirmed'] ?? false)) {
            throw ValidationException::withMessages(['github' => 'Confirme que deseja continuar sem GitHub.']);
        }

        return $result;
    }

    public function origin(array $data): array
    {
        return Validator::make($data, [
            'referral_source' => ['required', 'string', 'max:255'],
            'collaboration_interest' => ['required', 'boolean'],
        ])->validate();
    }

    public function validateSubmission(Applicant $applicant): void
    {
        if ($applicant->current_step !== 'ready') {
            throw ValidationException::withMessages(['step' => 'Conclua todas as etapas.']);
        }
        $values = $this->fields($applicant);
        $this->identification($values);
        $this->profiles($values);
        $this->origin($values);
        $this->terms->ensureCurrent($applicant);
    }

    public function fields(Applicant $a): array
    {
        return [
            'email' => $a->email, 'first_name' => $a->first_name, 'last_name' => $a->last_name,
            'whatsapp' => $a->whatsapp, 'linkedin' => $a->linkedin, 'github' => $a->github,
            'instagram' => $a->instagram, 'referral_source' => $a->referral_source,
            'collaboration_interest' => $a->collaboration_interest,
            'github_skip_confirmed' => $a->github_skip_confirmed_at !== null,
        ];
    }
}
