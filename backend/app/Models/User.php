<?php

namespace App\Models;

use App\Enums\MemberType;
use App\Models\Concerns\HasUuidV7;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasUuidV7;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = ['name', 'email', 'status', 'member_type'];

    protected function casts(): array
    {
        return ['member_type' => MemberType::class];
    }

    protected $hidden = ['email'];

    public function otpRequests(): HasMany
    {
        return $this->hasMany(OtpRequest::class);
    }

    public function authenticatedSessions(): HasMany
    {
        return $this->hasMany(AuthenticatedSession::class);
    }

    public function preference(): HasOne
    {
        return $this->hasOne(UserPreference::class);
    }
}
