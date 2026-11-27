<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('applicant_consents', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('applicant_id')->constrained('applicants')->restrictOnDelete();
            $table->string('consent_key', 64);
            $table->string('version', 64);
            $table->timestamp('accepted_at');

            $table->unique(['applicant_id', 'consent_key', 'version']);
        });

        Schema::create('applicant_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('applicant_id')->constrained('applicants')->restrictOnDelete();
            $table->string('event_key', 128);
            $table->string('event_type', 32);
            $table->string('step', 32)->nullable();
            $table->timestamp('occurred_at');
            $table->foreignUuid('actor_user_id')->nullable()->constrained('users')->restrictOnDelete();

            $table->unique(['applicant_id', 'event_key']);
            $table->index(['applicant_id', 'occurred_at']);
        });
    }

    public function down(): void
    {
        if (DB::table('applicant_events')->exists() || DB::table('applicant_consents')->exists()) {
            throw new RuntimeException('Cannot remove application audit history. Restore a verified backup instead.');
        }

        Schema::dropIfExists('applicant_events');
        Schema::dropIfExists('applicant_consents');
    }
};
