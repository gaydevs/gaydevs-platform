<?php

return [
    'otp' => [
        'digits' => 6,
        'expires_in_minutes' => 10,
        'max_verification_attempts' => 5,
        'max_generation_attempts' => 100,
        'superseded_code_lookup_limit' => 5,
    ],

    'search' => [
        'query_max_characters' => 100,
        'max_results' => 5,
    ],

    'rate_limits' => [
        'request_per_user' => [
            'max_attempts' => 5,
            'decay_seconds' => 3600,
        ],
        'request_per_ip' => [
            'max_attempts' => 20,
            'decay_seconds' => 3600,
        ],
        'request_global' => [
            'max_attempts' => (int) env('PASSWORDLESS_GLOBAL_OTP_MAX_ATTEMPTS', 100),
            'decay_seconds' => (int) env('PASSWORDLESS_GLOBAL_OTP_DECAY_SECONDS', 3600),
        ],
        'email_global' => [
            'max_attempts' => (int) env('PASSWORDLESS_GLOBAL_EMAIL_MAX_ATTEMPTS', 100),
            'decay_seconds' => (int) env('PASSWORDLESS_GLOBAL_EMAIL_DECAY_SECONDS', 3600),
        ],
        'search_per_ip' => [
            'max_attempts' => 60,
            'decay_seconds' => 60,
        ],
        'verify_per_ip' => [
            'max_attempts' => 20,
            'decay_seconds' => 3600,
        ],
    ],
];
