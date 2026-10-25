<?php

namespace App\Services\GeoIp;

interface GeoIpDatabaseDownloader
{
    public function download(string $edition, string $destination): void;
}
