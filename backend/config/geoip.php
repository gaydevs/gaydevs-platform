<?php

return [
    'city_database' => env('GEOIP_CITY_DATABASE'),
    'asn_database' => env('GEOIP_ASN_DATABASE'),
    'update_enabled' => (bool) env('GEOIP_UPDATE_ENABLED', false),
    'update_binary' => env('GEOIPUPDATE_BINARY'),
    'update_config' => env('GEOIPUPDATE_CONFIG'),
    'database_directory' => env('GEOIP_DATABASE_DIRECTORY'),
    'warning_age_days' => (int) env('GEOIP_WARNING_AGE_DAYS', 7),
    'max_age_days' => (int) env('GEOIP_MAX_AGE_DAYS', 30),
    'lookup_ttl_hours' => (int) env('GEOIP_LOOKUP_TTL_HOURS', 24),
    'retry_minutes' => (int) env('GEOIP_RETRY_MINUTES', 60),
];
