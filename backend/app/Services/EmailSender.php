<?php

namespace App\Services;

use App\Support\RequestCorrelation;
use Illuminate\Contracts\Mail\Mailable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class EmailSender
{
    public function __construct(
        private readonly EmailRateLimiter $limiter,
        private readonly SmtpTransportStateStore $state,
    ) {}

    public function ensureCapacity(): void
    {
        $this->limiter->assertAvailable();
    }

    public function reserve(): void
    {
        $this->limiter->reserve();
    }

    public function send(string $recipient, Mailable $message): void
    {
        $this->reserve();
        $this->sendReserved($recipient, $message);
    }

    public function sendReserved(string $recipient, Mailable $message): void
    {
        try {
            Mail::to($recipient)->send($message);
        } catch (Throwable $exception) {
            Log::channel('operational')->error('email.send_failed', [
                'request_id' => $this->requestId(),
                'mailer' => (string) config('mail.default', 'log'),
                'exception' => $exception::class,
            ]);

            throw $exception;
        }

        $this->state->recordAccepted();
    }

    private function requestId(): ?string
    {
        if (! app()->bound('request')) {
            return null;
        }

        $request = app('request');

        return $request instanceof Request ? RequestCorrelation::id($request) : null;
    }
}
