<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class ApplicationSubmittedMail extends Mailable
{
    public function __construct(public readonly string $reviewUrl) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Nova candidatura GayDevs');
    }

    public function content(): Content
    {
        return new Content(text: 'mail.application-submitted');
    }
}
