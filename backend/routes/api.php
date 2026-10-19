<?php

use Illuminate\Support\Facades\Route;

Route::get('/ping', static fn (): string => 'pong');
