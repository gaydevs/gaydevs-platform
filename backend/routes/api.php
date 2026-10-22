<?php

use App\Http\Controllers\LogoutAllController;
use App\Http\Controllers\LogoutController;
use App\Http\Controllers\RequestOtpController;
use App\Http\Controllers\UserSearchController;
use App\Http\Controllers\VerifyOtpController;
use App\Http\Middleware\EnsureUserIsActive;
use Illuminate\Support\Facades\Route;

Route::get('/ping', static fn (): string => 'pong');
Route::get('/users', UserSearchController::class);
Route::post('/auth/otp', RequestOtpController::class);
Route::post('/auth/verify', VerifyOtpController::class);
Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(function (): void {
    Route::post('/auth/logout', LogoutController::class);
    Route::post('/auth/logout-all', LogoutAllController::class);
});
