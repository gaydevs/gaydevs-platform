<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SmtpTransportState extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'last_accepted_at' => 'datetime',
        ];
    }
}
