<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApplicantEvent extends Model
{
    public $timestamps = false;

    protected $fillable = ['event_key', 'event_type', 'step', 'occurred_at', 'actor_user_id'];

    protected function casts(): array
    {
        return ['occurred_at' => 'datetime'];
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(Applicant::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
