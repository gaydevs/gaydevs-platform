<?php

namespace App\Console\Commands;

use App\Mail\SmtpKeepaliveMail;
use App\Services\EmailSender;
use App\Services\SmtpTransportStateStore;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class SmtpKeepalive extends Command
{
    private const MAILER = 'smtp';

    private const INACTIVITY_DAYS = 80;

    protected $signature = 'smtp:keepalive';

    protected $description = 'Mantém a chave SMTP ativa após o período de inatividade';

    public function handle(SmtpTransportStateStore $states, EmailSender $emails): int
    {
        if ((string) config('mail.default', 'log') !== self::MAILER) {
            $this->line('Keepalive ignorado: o mailer efetivo não é SMTP.');

            return self::SUCCESS;
        }

        $lastAcceptedAt = $states->lastAcceptedAt(self::MAILER);

        if ($lastAcceptedAt === null) {
            $this->line('Keepalive ignorado: ainda não há envio SMTP aceito registrado.');

            return self::SUCCESS;
        }

        if ($lastAcceptedAt->isAfter(now()->subDays(self::INACTIVITY_DAYS))) {
            $this->line('Keepalive ignorado: o transporte SMTP teve atividade recente.');

            return self::SUCCESS;
        }

        $recipient = (string) config('mail.from.address', '');

        if (trim($recipient) === '') {
            $this->logFailure(new RuntimeException('MAIL_FROM_ADDRESS não está configurado.'));

            return self::FAILURE;
        }

        try {
            $emails->send($recipient, new SmtpKeepaliveMail);
        } catch (Throwable $exception) {
            $this->logFailure($exception);

            return self::FAILURE;
        }

        $this->info('Keepalive SMTP enviado.');

        return self::SUCCESS;
    }

    private function logFailure(Throwable $exception): void
    {
        Log::channel('operational')->error('smtp.keepalive_failed', [
            'mailer' => self::MAILER,
            'exception' => $exception::class,
        ]);

        $this->error('Falha ao executar o keepalive SMTP.');
    }
}
