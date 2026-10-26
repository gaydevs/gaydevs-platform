<?php

namespace App\Models;

use Database\Factories\AuthenticatedSessionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AuthenticatedSession extends Model
{
    /** @use HasFactory<AuthenticatedSessionFactory> */
    use HasFactory;

    public const SESSION_KEY = 'authenticated_session_id';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'authenticated_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function observations(): HasMany
    {
        return $this->hasMany(VisitorObservation::class);
    }
}
