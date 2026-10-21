<?php

return [
    'otp' => [
        'digits' => 6,
        'expires_in_minutes' => 10,
        'max_verification_attempts' => 5,
        'max_generation_attempts' => 100,
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
        'search_per_ip' => [
            'max_attempts' => 60,
            'decay_seconds' => 60,
        ],
    ],
];
