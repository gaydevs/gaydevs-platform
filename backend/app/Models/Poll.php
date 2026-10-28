<?php

namespace App\Models;

use App\Models\Concerns\HasUuidV7;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class Poll extends Model
{
    use HasFactory, HasUuidV7;

    protected $fillable = [
        'created_by_user_id',
        'question',
        'slug',
        'started_at',
        'started_on',
        'allow_multiple',
        'allow_new_options',
        'closed_at',
        'closed_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'allow_multiple' => 'boolean',
            'allow_new_options' => 'boolean',
            'started_at' => 'datetime',
            'started_on' => 'date',
            'closed_at' => 'datetime',
        ];
    }

    public function options(): HasMany
    {
        return $this->hasMany(PollOption::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by_user_id');
    }

    public function votes(): HasMany
    {
        return $this->hasMany(PollVote::class);
    }

    public function activeVotes(): HasMany
    {
        return $this->votes()->where('status', PollVote::STATUS_ACTIVE);
    }

    public function isClosed(): bool
    {
        return $this->closed_at instanceof Carbon && $this->closed_at->isPast();
    }
}
