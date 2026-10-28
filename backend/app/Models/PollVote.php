<?php

namespace App\Models;

use App\Enums\PollVoteCancellationReason;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PollVote extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_CANCELED = 'canceled';

    protected $fillable = ['poll_id', 'poll_option_id', 'user_id', 'status', 'cancellation_reason', 'canceled_at'];

    protected function casts(): array
    {
        return [
            'cancellation_reason' => PollVoteCancellationReason::class,
            'canceled_at' => 'datetime',
        ];
    }

    public function poll(): BelongsTo
    {
        return $this->belongsTo(Poll::class);
    }

    public function option(): BelongsTo
    {
        return $this->belongsTo(PollOption::class, 'poll_option_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
