<?php

namespace App\Enums;

enum OtpPurpose: string
{
    case Login = 'login';
    case Registration = 'registration';
}
