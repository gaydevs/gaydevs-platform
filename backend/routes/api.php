<?php

use App\Http\Controllers\AdminApplicationController;
use App\Http\Controllers\ApplicationAuthController;
use App\Http\Controllers\ApplicationController;
use App\Http\Controllers\CurrentSessionController;
use App\Http\Controllers\LogoutAllController;
use App\Http\Controllers\LogoutController;
use App\Http\Controllers\PollController;
use App\Http\Controllers\RequestOtpController;
use App\Http\Controllers\SocialPreviewController;
use App\Http\Controllers\UserPreferenceController;
use App\Http\Controllers\UserSearchController;
use App\Http\Controllers\VerifyOtpController;
use App\Http\Middleware\EnsureApplicantSession;
use App\Http\Middleware\EnsureApplicationFrontend;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\EnsureUserIsPollAdmin;
use Illuminate\Support\Facades\Route;

Route::get('/applications/terms', [ApplicationController::class, 'terms']);

Route::prefix('applications')->middleware(EnsureApplicationFrontend::class)->group(function (): void {
    Route::post('/otp', [ApplicationAuthController::class, 'issue']);
    Route::post('/verify', [ApplicationAuthController::class, 'verify']);
    Route::get('/session', [ApplicationAuthController::class, 'session'])->middleware(EnsureApplicantSession::class);
    Route::post('/logout', [ApplicationAuthController::class, 'logout']);
    Route::patch('/steps/{step}', [ApplicationController::class, 'step'])->middleware(EnsureApplicantSession::class.':write');
    Route::post('/submit', [ApplicationController::class, 'submit'])->middleware(EnsureApplicantSession::class);
});

Route::get('/ping', static fn (): string => 'pong');
Route::get('/users', UserSearchController::class);
Route::post('/auth/otp', RequestOtpController::class);
Route::post('/auth/verify', VerifyOtpController::class);
Route::get('/polls/{identifier}', [PollController::class, 'show'])->name('poll.show');
Route::get('/social/preview/{path?}', SocialPreviewController::class)
    ->where('path', '.*');
Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(function (): void {
    Route::prefix('admin/applications')->middleware(EnsureUserIsAdmin::class)->group(function (): void {
        Route::get('/', [AdminApplicationController::class, 'index']);
        Route::get('/{id}', [AdminApplicationController::class, 'show'])->whereUuid('id');
        Route::patch('/{id}/notes', [AdminApplicationController::class, 'notes'])->whereUuid('id');
        Route::post('/{id}/approve', [AdminApplicationController::class, 'approve'])->whereUuid('id');
        Route::post('/{id}/reject', [AdminApplicationController::class, 'reject'])->whereUuid('id');
    });
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
