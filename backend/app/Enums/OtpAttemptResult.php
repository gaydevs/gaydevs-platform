<?php

namespace App\Enums;

enum OtpAttemptResult: string
{
    case Accepted = 'accepted';
    case InvalidCode = 'invalid_code';
    case Expired = 'expired';
    case AlreadyUsed = 'already_used';
    case Locked = 'locked';
    case Superseded = 'superseded';
    case RateLimited = 'rate_limited';
}
