<?php

namespace App\Services;

use Illuminate\Contracts\Mail\Mailable;
use Illuminate\Support\Facades\Mail;

class EmailSender
{
    public function __construct(private readonly EmailRateLimiter $limiter) {}

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
        Mail::to($recipient)->send($message);
    }
}
