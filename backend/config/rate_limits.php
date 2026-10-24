<?php

return [
    'global' => [
        'otp' => [
            'max_attempts' => (int) env('RATE_LIMIT_GLOBAL_OTP_MAX_ATTEMPTS', 100),
            'decay_seconds' => (int) env('RATE_LIMIT_GLOBAL_OTP_DECAY_SECONDS', 3600),
        ],
        'email' => [
            'max_attempts' => (int) env('RATE_LIMIT_GLOBAL_EMAIL_MAX_ATTEMPTS', 100),
            'decay_seconds' => (int) env('RATE_LIMIT_GLOBAL_EMAIL_DECAY_SECONDS', 3600),
        ],
    ],
];
