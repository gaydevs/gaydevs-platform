<?php

namespace App\Models;

use App\Models\Concerns\HasUuidV7;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PollOption extends Model
{
    use HasUuidV7;

    protected $fillable = ['poll_id', 'created_by_user_id', 'label', 'hidden_at', 'hidden_by_user_id'];

    protected function casts(): array
    {
        return ['hidden_at' => 'datetime'];
    }

    public function poll(): BelongsTo
    {
        return $this->belongsTo(Poll::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function hiddenBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'hidden_by_user_id');
    }

    public function votes(): HasMany
    {
        return $this->hasMany(PollVote::class);
    }

    public function activeVotes(): HasMany
    {
        return $this->votes()->where('status', PollVote::STATUS_ACTIVE);
    }
}
