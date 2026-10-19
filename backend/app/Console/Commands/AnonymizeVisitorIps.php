<?php

namespace App\Console\Commands;

use App\Models\IpAddress;
use App\Services\IpAnonymizer;
use Illuminate\Console\Command;

class AnonymizeVisitorIps extends Command
{
    protected $signature = 'visitors:anonymize-ips';

    protected $description = 'Trunca IPs de visitantes inativos há pelo menos 90 dias';

    public function handle(IpAnonymizer $anonymizer): int
    {
        IpAddress::query()
            ->whereNull('ip_anonymized_at')
            ->whereNotNull('ip')
            ->where('last_observed_at', '<=', now()->subDays(90))
            ->chunkById(100, function ($addresses) use ($anonymizer): void {
                foreach ($addresses as $address) {
                    /** @var IpAddress $address */
                    $address->update([
                        'ip' => $anonymizer->anonymize($address->ip),
                        'ip_anonymized_at' => now(),
                    ]);
                }
            });

        return self::SUCCESS;
    }
}
