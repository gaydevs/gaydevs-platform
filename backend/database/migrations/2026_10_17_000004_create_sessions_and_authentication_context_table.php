<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sessions', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->foreignUuid('user_id')->nullable()->index()->constrained('users')->restrictOnDelete();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });

        Schema::create('authenticated_sessions', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('user_id')->constrained('users')->restrictOnDelete();
            $table->timestamp('authenticated_at');
            $table->timestamp('last_seen_at');
            $table->timestamp('ended_at')->nullable();
            $table->string('end_reason', 32)->nullable();
            $table->timestamps();
            $table->index(['user_id', 'last_seen_at']);
            $table->index(['ended_at', 'last_seen_at']);
        });

        Schema::table('visitor_observations', function (Blueprint $table): void {
            $table->foreignId('authenticated_session_id')
                ->nullable()
                ->constrained('authenticated_sessions')
                ->restrictOnDelete();
            $table->foreignId('personal_access_token_id')
                ->nullable()
                ->constrained('personal_access_tokens')
                ->restrictOnDelete();
            $table->index(['authenticated_session_id', 'observed_at']);
            $table->index(['personal_access_token_id', 'observed_at']);
        });
    }

    public function down(): void
    {
        Schema::table('visitor_observations', function (Blueprint $table): void {
            $table->dropIndex(['personal_access_token_id', 'observed_at']);
            $table->dropIndex(['authenticated_session_id', 'observed_at']);
            $table->dropConstrainedForeignId('personal_access_token_id');
            $table->dropConstrainedForeignId('authenticated_session_id');
        });
        Schema::dropIfExists('authenticated_sessions');
        Schema::dropIfExists('sessions');
    }
};
