<?php

namespace App\Models;

use Database\Factories\VisitorObservationFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Sanctum\PersonalAccessToken;

class VisitorObservation extends Model
{
    /** @use HasFactory<VisitorObservationFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['observed_at' => 'datetime'];
    }

    public function visit(): BelongsTo
    {
        return $this->belongsTo(Visit::class);
    }

    public function ipGeolocation(): BelongsTo
    {
        return $this->belongsTo(IpGeolocation::class);
    }

    public function authenticatedSession(): BelongsTo
    {
        return $this->belongsTo(AuthenticatedSession::class);
    }

    public function personalAccessToken(): BelongsTo
    {
        return $this->belongsTo(PersonalAccessToken::class);
    }

    public function otpRequests(): HasMany
    {
        return $this->hasMany(OtpRequest::class);
    }
}
