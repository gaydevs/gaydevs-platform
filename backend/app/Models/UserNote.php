<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserNote extends Model
{
    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['user_id', 'content'];
}
