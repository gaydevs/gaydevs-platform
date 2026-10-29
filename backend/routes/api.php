<?php

use App\Http\Controllers\CurrentSessionController;
use App\Http\Controllers\LogoutAllController;
use App\Http\Controllers\LogoutController;
use App\Http\Controllers\PollController;
use App\Http\Controllers\RequestOtpController;
use App\Http\Controllers\SocialPreviewController;
use App\Http\Controllers\UserPreferenceController;
use App\Http\Controllers\UserSearchController;
use App\Http\Controllers\VerifyOtpController;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\EnsureUserIsPollAdmin;
use Illuminate\Support\Facades\Route;

Route::get('/ping', static fn (): string => 'pong');
Route::get('/users', UserSearchController::class);
Route::post('/auth/otp', RequestOtpController::class);
Route::post('/auth/verify', VerifyOtpController::class);
Route::get('/polls/{identifier}', [PollController::class, 'show'])->name('poll.show');
Route::get('/social/preview/{path?}', SocialPreviewController::class)
    ->where('path', '.*');
Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(function (): void {
    Route::get('/auth/session', CurrentSessionController::class);
    Route::get('/me/preferences', [UserPreferenceController::class, 'show']);
    Route::post('/me/preferences/poll-suggestions/snooze', [UserPreferenceController::class, 'snoozePollSuggestions']);
    Route::post('/me/preferences/poll-suggestions/dismiss', [UserPreferenceController::class, 'dismissPollSuggestion']);
    Route::post('/auth/logout', LogoutController::class);
    Route::post('/auth/logout-all', LogoutAllController::class);
    Route::get('/polls', [PollController::class, 'index']);
    Route::get('/polls/{identifier}/audit', [PollController::class, 'audit']);
    Route::post('/polls/{identifier}/responses', [PollController::class, 'submit']);
    Route::post('/polls/{identifier}/options', [PollController::class, 'addOption']);
    Route::delete('/polls/{identifier}/options/{option}', [PollController::class, 'removeOption']);
    Route::middleware(EnsureUserIsPollAdmin::class)->group(function (): void {
        Route::post('/polls', [PollController::class, 'store']);
        Route::post('/polls/{identifier}/close', [PollController::class, 'close']);
        Route::post('/polls/{identifier}/options/{option}/hide', [PollController::class, 'hideOption']);
    });
});
