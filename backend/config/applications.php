<?php

return [
    'enabled' => env('APPLICATIONS_ENABLED', false),
    'admin_email' => env('APPLICATION_ADMIN_EMAIL'),
    'whatsapp' => env('GDEV_SM_WHATSAPP'),
    'turnstile' => [
        'sitekey' => env('APPLICATION_TURNSTILE_SITEKEY'),
        'secret' => env('APPLICATION_TURNSTILE_SECRET'),
        'hostname' => env('APPLICATION_TURNSTILE_HOSTNAME'),
        'action' => env('APPLICATION_TURNSTILE_ACTION', 'application_otp'),
    ],
    'limits' => [
        'cooldown' => (int) env('APPLICATION_OTP_COOLDOWN', 60),
        'email_hour' => (int) env('APPLICATION_OTP_EMAIL_HOUR', 5),
        'ip_hour' => (int) env('APPLICATION_OTP_IP_HOUR', 10),
        'otp_day' => (int) env('APPLICATION_OTP_DAY', 50),
        'verify_ip_hour' => (int) env('APPLICATION_VERIFY_IP_HOUR', 20),
        'attempts' => (int) env('APPLICATION_OTP_ATTEMPTS', 5),
        'mail_day' => (int) env('APPLICATION_MAIL_DAY', 100),
    ],
    'session' => [
        'idle_days' => (int) env('APPLICATION_SESSION_IDLE_DAYS', 30),
        'absolute_days' => (int) env('APPLICATION_SESSION_ABSOLUTE_DAYS', 90),
    ],
];
