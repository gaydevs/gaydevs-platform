<?php

use App\Mail\LoginOtpMail;
use Illuminate\Mail\Transport\ArrayTransport;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mime\Email;

test('login otp email uses the globally configured from address', function () {
    config([
        'mail.from.address' => 'login@gaydevs.test',
        'mail.from.name' => 'gaydevs',
    ]);
    Mail::forgetMailers();

    try {
        $mailer = Mail::mailer('array');
        $mailer->to('user@example.test')->send(new LoginOtpMail('123456'));

        $transport = $mailer->getSymfonyTransport();
        expect($transport)->toBeInstanceOf(ArrayTransport::class);

        /** @var Email $message */
        $message = $transport->messages()->sole()->getOriginalMessage();
        $from = $message->getFrom();

        expect($from)->toHaveCount(1)
            ->and($from[0]->getAddress())->toBe('login@gaydevs.test')
            ->and($from[0]->getName())->toBe('gaydevs');
    } finally {
        Mail::forgetMailers();
    }
});
