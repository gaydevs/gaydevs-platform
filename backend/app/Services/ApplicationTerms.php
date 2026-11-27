<?php

namespace App\Services;

use App\Models\Applicant;
use Illuminate\Validation\ValidationException;

class ApplicationTerms
{
    // Only a human-reviewed release may replace the draft and set this to true.
    public const FINALIZED = false;

    public const VERSION = '2026-11-27-draft-1';

    public function texts(): array
    {
        return [
            'gay_dev' => 'Confirmo que sou gay e trabalho ou estudo desenvolvimento de software.',
            'community' => 'Conheço a proposta de uma comunidade engajada e coesa, não necessariamente grande.',
            'values' => 'Compreendo o caráter progressista, de esquerda, inclusivo e seguro da comunidade, sem declaração de preferência partidária.',
            'sfw' => 'Li e aceito as regras básicas do grupo principal SFW, primeiro grupo de ingresso: respeito, convivência e ausência de conteúdo adulto ou flerte.',
            'nsfw' => 'Respeitarei a restrição de conteúdo adulto e flerte ao único grupo NSFW, /gdevs/off-topic-nsfw.',
            'personal_data' => 'Autorizo especificamente o tratamento dos dados pessoais e sensíveis informados para análise da candidatura e administração da comunidade.',
            'external_profiles' => 'Autorizo a consulta limitada aos perfis externos que informei para validar os links e analisar minha candidatura.',
        ];
    }

    public function publicData(): array
    {
        return [
            'version' => self::VERSION,
            'privacy_notice' => 'Minuta para validação do responsável: GayDevs trata e-mail, identificação, contatos, perfis, origem, interesse de colaboração, aceites e decisões para analisar candidaturas e administrar a comunidade. O acesso é restrito à administração autorizada; serviços de e-mail, antispam e plataformas dos perfis participam das operações necessárias. O histórico é preservado sem exclusão automática; a retenção deverá observar a finalidade e os direitos dos titulares. Para exercer seus direitos ou esclarecer dúvidas, utilize o canal de privacidade divulgado pela comunidade antes da ativação do cadastro.',
            'consents' => collect($this->texts())->map(fn ($text, $key) => ['key' => $key, 'version' => self::VERSION, 'text' => $text])->values()->all(),
        ];
    }

    public function validateAcceptance(array $acceptances, array $keys): void
    {
        foreach ($keys as $key) {
            if (($acceptances[$key] ?? null) !== self::VERSION) {
                throw ValidationException::withMessages(['consents' => 'Confirme todos os aceites da versão atual.']);
            }
        }
    }

    public function record(Applicant $applicant, array $keys): void
    {
        foreach ($keys as $key) {
            $applicant->consents()->firstOrCreate(['consent_key' => $key, 'version' => self::VERSION], ['accepted_at' => now()]);
        }
    }

    public function ensureCurrent(Applicant $applicant): void
    {
        $keys = $applicant->consents()->where('version', self::VERSION)->pluck('consent_key')->all();
        if (array_diff(array_keys($this->texts()), $keys) !== []) {
            throw ValidationException::withMessages(['consents' => 'Confirme todos os aceites da versão atual.']);
        }
    }
}
