<?php

namespace App\Models;

use App\Enums\ApplicantStatus;
use App\Models\Concerns\HasUuidV7;
use Database\Factories\ApplicantFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Applicant extends Model
{
    /** @use HasFactory<ApplicantFactory> */
    use HasFactory, HasUuidV7;

    protected $fillable = [
        'email',
        'first_name',
        'last_name',
        'whatsapp',
        'linkedin',
        'github',
        'instagram',
        'referral_source',
        'collaboration_interest',
    ];

    protected $hidden = [
        'email',
        'active_email',
        'first_name',
        'last_name',
        'whatsapp',
        'linkedin',
        'github',
        'instagram',
        'referral_source',
        'collaboration_interest',
        'github_skip_confirmed_at',
        'admin_notes',
        'reviewed_by',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => ApplicantStatus::class,
            'collaboration_interest' => 'boolean',
            'revision' => 'integer',
            'github_skip_confirmed_at' => 'datetime',
            'email_verified_at' => 'datetime',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public static function normalizeEmail(string $email): string
    {
        return mb_strtolower(trim($email));
    }

    protected function email(): Attribute
    {
        return Attribute::make(set: fn (string $value): string => self::normalizeEmail($value));
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function consents(): HasMany
    {
        return $this->hasMany(ApplicantConsent::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(ApplicantEvent::class);
    }
}
