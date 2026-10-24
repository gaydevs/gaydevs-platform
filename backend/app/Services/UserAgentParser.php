<?php

namespace App\Services;

class UserAgentParser
{
    /** @return array{browser: string, os: string, device_type: string} */
    public function parse(?string $userAgent): array
    {
        $agent = strtolower($userAgent ?? '');

        $browser = match (true) {
            str_contains($agent, 'edg/') => 'Edge',
            str_contains($agent, 'firefox/') => 'Firefox',
            str_contains($agent, 'chrome/') => 'Chrome',
            str_contains($agent, 'safari/') => 'Safari',
            default => 'Other',
        };
        $os = match (true) {
            str_contains($agent, 'windows') => 'Windows',
            str_contains($agent, 'android') => 'Android',
            str_contains($agent, 'iphone'), str_contains($agent, 'ipad') => 'iOS',
            str_contains($agent, 'mac os') => 'macOS',
            str_contains($agent, 'linux') => 'Linux',
            default => 'Other',
        };
        $deviceType = match (true) {
            str_contains($agent, 'ipad'), str_contains($agent, 'tablet') => 'tablet',
            str_contains($agent, 'mobile'), str_contains($agent, 'iphone'), str_contains($agent, 'android') => 'mobile',
            default => 'desktop',
        };

        return ['browser' => $browser, 'os' => $os, 'device_type' => $deviceType];
    }
}
