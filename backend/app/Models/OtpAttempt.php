<?php

namespace App\Models;

use App\Enums\OtpAttemptResult;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OtpAttempt extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'result' => OtpAttemptResult::class,
            'attempted_at' => 'datetime',
        ];
    }

    public function otpRequest(): BelongsTo
    {
        return $this->belongsTo(OtpRequest::class);
    }

    public function matchedOtpRequest(): BelongsTo
    {
        return $this->belongsTo(OtpRequest::class, 'matched_otp_request_id');
    }

    public function visitorObservation(): BelongsTo
    {
        return $this->belongsTo(VisitorObservation::class);
    }

    public function authenticatedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'authenticated_user_id');
    }
}
