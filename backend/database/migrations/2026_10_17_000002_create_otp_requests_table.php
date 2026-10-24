<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('otp_requests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('visitor_observation_id')->constrained()->restrictOnDelete();
            $table->string('code_hash');
            $table->string('status', 20)->default('pending');
            $table->unsignedTinyInteger('failed_attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('superseded_at')->nullable();
            $table->foreignUuid('superseded_by_id')->nullable()->constrained('otp_requests')->restrictOnDelete();
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
            $table->index(['status', 'expires_at']);
        });

        Schema::create('otp_attempts', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('otp_request_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('matched_otp_request_id')->nullable()->constrained('otp_requests')->restrictOnDelete();
            $table->foreignId('visitor_observation_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('authenticated_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('result', 24);
            $table->timestamp('attempted_at');
            $table->timestamp('created_at')->nullable();
            $table->index(['otp_request_id', 'attempted_at']);
            $table->index(['result', 'attempted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('otp_attempts');
        Schema::dropIfExists('otp_requests');
    }
};
