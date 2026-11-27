<?php

namespace App\Services;

use App\Models\Applicant;
use Illuminate\Validation\ValidationException;

class ApplicationTerms
{
    // Only a human-reviewed release may replace the draft and set this to true.
    public const FINALIZED = false;

    public const VERSION = '2026-11-27-draft-3';

    public function texts(): array
    {
        return [
            'gay_dev' => 'Confirmo que sou gay e trabalho ou estudo desenvolvimento de software.',
            'community' => 'Conheço a proposta de uma comunidade engajada e coesa, não necessariamente grande.',
            'values' => 'Compreendo o caráter progressista, de esquerda, inclusivo e seguro da comunidade, sem declaração de preferência partidária.',
            'sfw' => 'Li e aceito as regras básicas do grupo principal SFW, primeiro grupo de ingresso: respeito, convivência e ausência de conteúdo adulto ou flerte.',
            'nsfw' => 'Respeitarei a restrição de conteúdo adulto e flerte ao único grupo NSFW.',
            'personal_data' => 'Autorizo o tratamento dos meus dados pessoais e sensíveis, inclusive a informação sobre orientação sexual, para analisar minha candidatura, administrar a comunidade e conhecer o perfil dos integrantes, conforme o aviso de privacidade.',
            'external_profiles' => 'Autorizo a consulta e a coleta de dados dos perfis informados para validar os links, analisar minha candidatura e compor o perfil da comunidade.',
        ];
    }

    public function publicData(): array
    {
        return [
            'version' => self::VERSION,
            'privacy_notice' => 'Usamos seus dados pessoais e sensíveis para analisar a candidatura, administrar a comunidade e conhecer o perfil dos integrantes. Consulte a política de privacidade e fale com a administração pelos contatos do rodapé.',
            'privacy_sections' => [
                ['id' => 'responsavel', 'title' => 'Responsável e contato', 'text' => 'A pessoa física responsável pela administração do GayDevs é a controladora dos dados. Sua identificação e o atendimento aos titulares estão disponíveis pelos canais de contato da administração no rodapé de todas as páginas.'],
                ['id' => 'dados', 'title' => 'Dados e finalidades', 'text' => 'Tratamos e-mail, nome, WhatsApp, links de perfis, origem da candidatura, interesse em colaboração, aceites, etapas e decisões para cadastro, admissão e administração da comunidade. A participação pode revelar orientação sexual, um dado sensível. Usamos consentimento específico para os dados da candidatura; registros de autenticação, cookies necessários, IP e controles antispam servem à segurança, à prevenção de fraude e ao funcionamento da plataforma. Não publicamos dados de candidatos.'],
                ['id' => 'perfis', 'title' => 'Perfis externos', 'text' => 'Com sua autorização, consultamos os perfis informados e os dados a que temos acesso legítimo, inclusive informações não públicas disponibilizadas por você, para validar links e analisar candidaturas. Não solicitamos senhas nem contornamos restrições de acesso. A composição do perfil da comunidade usa informações necessárias a essa finalidade, preferencialmente agregadas.'],
                ['id' => 'compartilhamento', 'title' => 'Acesso e compartilhamento', 'text' => 'Os dados cadastrais são acessíveis à administração autorizada. Hospedagem, e-mail e proteção antispam processam os dados necessários à operação; a validação do GitHub consulta o identificador informado. Esses serviços podem envolver tratamento fora do Brasil. Não comercializamos dados pessoais nem publicamos candidaturas.'],
                ['id' => 'retencao', 'title' => 'Retenção e segurança', 'text' => 'Preservamos registros enquanto necessários às finalidades informadas, ao histórico e à prevenção de fraudes e abusos, com fundamento legal aplicável e acesso restrito. Não há exclusão automática. Quando a conservação deixar de ser justificada, avaliamos eliminação ou anonimização, inclusive por solicitação.'],
                ['id' => 'direitos', 'title' => 'Seus direitos', 'text' => 'Você pode solicitar gratuitamente confirmação e acesso, correção, anonimização, bloqueio ou eliminação quando cabível, informação sobre compartilhamento, portabilidade conforme regulamentação, revisão de decisões automatizadas quando aplicável, revogação do consentimento e informações sobre suas consequências. A recusa ou revogação dos aceites necessários pode impedir a candidatura ou a continuidade da participação. Você também pode peticionar à ANPD. Contate a administração pelos links do rodapé.'],
            ],
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
