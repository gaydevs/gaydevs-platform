<?php

namespace App\Models;

use Database\Factories\IpGeolocationFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IpGeolocation extends Model
{
    /** @use HasFactory<IpGeolocationFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'city_database_built_at' => 'datetime',
            'asn_database_built_at' => 'datetime',
            'resolved_at' => 'datetime',
            'last_verified_at' => 'datetime',
            'valid_from' => 'datetime',
            'valid_until' => 'datetime',
        ];
    }

    public function ipAddress(): BelongsTo
    {
        return $this->belongsTo(IpAddress::class);
    }

    public function observations(): HasMany
    {
        return $this->hasMany(VisitorObservation::class);
    }
}
