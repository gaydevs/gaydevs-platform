<?php

namespace App\Services;

use App\Models\SmtpTransportState;
use Illuminate\Support\Carbon;

class SmtpTransportStateStore
{
    public function recordAccepted(): void
    {
        $mailer = $this->mailer();

        if ($mailer !== 'smtp') {
            return;
        }

        $timestamp = now();

        SmtpTransportState::query()->upsert(
            [[
                'mailer' => $mailer,
                'last_accepted_at' => $timestamp,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ]],
            ['mailer'],
            ['last_accepted_at', 'updated_at'],
        );
    }

    public function lastAcceptedAt(?string $mailer = null): ?Carbon
    {
        $state = SmtpTransportState::query()
            ->where('mailer', $mailer ?? $this->mailer())
            ->first();

        return $state?->last_accepted_at;
    }

    private function mailer(): string
    {
        return (string) config('mail.default', 'log');
    }
}
