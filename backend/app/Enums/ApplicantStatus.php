<?php

namespace App\Enums;

enum ApplicantStatus: string
{
    case Unverified = 'unverified';
    case Draft = 'draft';
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';

    public function isOpen(): bool
    {
        return match ($this) {
            self::Unverified, self::Draft, self::Pending => true,
            self::Approved, self::Rejected => false,
        };
    }
}
