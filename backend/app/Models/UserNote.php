<?php

namespace App\Models;

use App\Models\Concerns\HasUuidV7;
use Illuminate\Database\Eloquent\Model;

class UserNote extends Model
{
    use HasUuidV7;

    protected $fillable = ['author_id', 'user_id', 'content'];
}
