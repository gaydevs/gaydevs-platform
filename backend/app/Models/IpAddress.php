<?php

namespace App\Models;

use Database\Factories\IpAddressFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class IpAddress extends Model
{
    /** @use HasFactory<IpAddressFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'first_observed_at' => 'datetime',
            'last_observed_at' => 'datetime',
            'ip_anonymized_at' => 'datetime',
        ];
    }

    public function observations(): HasManyThrough
    {
        return $this->hasManyThrough(VisitorObservation::class, IpGeolocation::class);
    }

    public function geolocations(): HasMany
    {
        return $this->hasMany(IpGeolocation::class);
    }
}
