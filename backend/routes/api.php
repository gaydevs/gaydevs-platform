<?php

use App\Http\Controllers\RequestOtpController;
use App\Http\Controllers\UserSearchController;
use Illuminate\Support\Facades\Route;

Route::get('/ping', static fn (): string => 'pong');
Route::get('/users', UserSearchController::class);
Route::post('/auth/otp', RequestOtpController::class);
