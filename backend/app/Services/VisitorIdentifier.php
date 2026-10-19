<?php

namespace App\Services;

use App\Models\IpAddress;
use App\Models\Visit;
use App\Models\Visitor;
use App\Models\VisitorObservation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use Throwable;

class VisitorIdentifier
{
    public const VISITOR_COOKIE = 'gdev_visitor';

    public function __construct(
        private readonly IpGeolocationUpdater $geolocation,
        private readonly UserAgentParser $userAgents,
    ) {}

    public function identify(Request $request): VisitorObservation
    {
        $now = now();
        $visitor = $this->visitor($request, $now);
        $visit = $this->visit($visitor, $now);
        $ipAddress = $this->ipAddress($request->ip(), $now);
        $userAgent = (string) $request->userAgent() ?: null;

        $observation = VisitorObservation::query()->create([
            'visit_id' => $visit->id,
            'ip_geolocation_id' => $ipAddress === null
                ? null
                : $this->geolocation->update($ipAddress)->id,
            'user_agent' => $userAgent,
            ...$this->userAgents->parse($userAgent),
            'language' => mb_substr((string) $request->header('Accept-Language'), 0, 64) ?: null,
            'referer' => $request->headers->get('referer'),
            'method' => $request->getMethod(),
            'path' => mb_substr($request->path(), 0, 512),
            'observed_at' => $now,
        ]);

        $request->attributes->set('visit', $visit);
        $request->attributes->set('visitor_observation', $observation);

        return $observation;
    }

    private function visitor(Request $request, mixed $now): Visitor
    {
        $id = null;
        $cookie = $request->cookie(self::VISITOR_COOKIE);

        if (is_string($cookie)) {
            try {
                $decrypted = Crypt::decryptString($cookie);
                $id = Str::isUuid($decrypted) ? $decrypted : null;
            } catch (Throwable) {
                // Cookie inválido recebe uma nova identidade pseudônima.
            }
        }

        $visitor = $id === null ? null : Visitor::query()->find($id);
        $visitor ??= new Visitor(['first_seen_at' => $now]);
        $visitor->last_seen_at = $now;
        $visitor->save();

        return $visitor;
    }

    private function visit(Visitor $visitor, mixed $now): Visit
    {
        $query = Visit::query()
            ->whereBelongsTo($visitor)
            ->where('last_seen_at', '>=', now()->subMinutes(30));

        $visit = $query->latest('last_seen_at')->first();
        $visit ??= new Visit([
            'visitor_id' => $visitor->id,
            'started_at' => $now,
        ]);
        $visit->last_seen_at = $now;
        $visit->save();

        return $visit;
    }

    private function ipAddress(?string $ip, mixed $now): ?IpAddress
    {
        if ($ip === null || filter_var($ip, FILTER_VALIDATE_IP) === false) {
            return null;
        }

        $address = IpAddress::query()->where('ip', $ip)->whereNull('ip_anonymized_at')->first();
        $address ??= new IpAddress(['ip' => $ip, 'first_observed_at' => $now]);
        $address->fill([
            'last_observed_at' => $now,
        ]);
        $address->save();

        return $address;
    }
}
