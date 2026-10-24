<?php

namespace App\Enums;

enum OtpRequestStatus: string
{
    case Pending = 'pending';
    case Used = 'used';
    case Expired = 'expired';
    case Locked = 'locked';
    case Superseded = 'superseded';
}
