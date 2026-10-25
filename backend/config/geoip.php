<?php

return [
    'city_database' => env('GEOIP_CITY_DATABASE'),
    'asn_database' => env('GEOIP_ASN_DATABASE'),
    'update_enabled' => (bool) env('GEOIP_UPDATE_ENABLED', false),
    'account_id' => env('GEOIP_ACCOUNT_ID'),
    'license_key' => env('GEOIP_LICENSE_KEY'),
    'download_base_url' => env(
        'GEOIP_DOWNLOAD_BASE_URL',
        'https://download.maxmind.com/geoip/databases',
    ),
    'download_timeout_seconds' => (int) env('GEOIP_DOWNLOAD_TIMEOUT_SECONDS', 120),
    'download_retry_attempts' => (int) env('GEOIP_DOWNLOAD_RETRY_ATTEMPTS', 3),
    'download_retry_sleep_milliseconds' => (int) env('GEOIP_DOWNLOAD_RETRY_SLEEP_MILLISECONDS', 1000),
    'update_lock_file' => env('GEOIP_UPDATE_LOCK_FILE'),
    'database_directory' => env('GEOIP_DATABASE_DIRECTORY'),
    'warning_age_days' => (int) env('GEOIP_WARNING_AGE_DAYS', 7),
    'max_age_days' => (int) env('GEOIP_MAX_AGE_DAYS', 30),
    'lookup_ttl_hours' => (int) env('GEOIP_LOOKUP_TTL_HOURS', 24),
    'retry_minutes' => (int) env('GEOIP_RETRY_MINUTES', 60),
];
