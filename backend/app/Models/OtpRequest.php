<?php

namespace App\Models;

use App\Enums\OtpRequestStatus;
use App\Models\Concerns\HasUuidV7;
use Database\Factories\OtpRequestFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Hash;

class OtpRequest extends Model
{
    /** @use HasFactory<OtpRequestFactory> */
    use HasFactory, HasUuidV7;

    protected $guarded = [];

    protected $hidden = ['code_hash'];

    protected function casts(): array
    {
        return [
            'status' => OtpRequestStatus::class,
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
            'superseded_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function visitorObservation(): BelongsTo
    {
        return $this->belongsTo(VisitorObservation::class);
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(OtpAttempt::class);
    }

    public function supersededBy(): BelongsTo
    {
        return $this->belongsTo(self::class, 'superseded_by_id');
    }

    public function supersededRequests(): HasMany
    {
        return $this->hasMany(self::class, 'superseded_by_id');
    }

    public function matchesCode(string $code): bool
    {
        return Hash::check($code, $this->code_hash);
    }
}
