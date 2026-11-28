<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('applicant_sessions', function (Blueprint $table): void {
            $table->foreignUuid('applicant_id')->primary()->constrained('applicants')->restrictOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->timestamp('verified_at');
            $table->timestamp('last_seen_at');
            $table->timestamp('expires_at');
        });
    }

    public function down(): void
    {
        if (DB::table('applicant_sessions')->exists()) {
            throw new RuntimeException('Cannot remove active application sessions. Restore a verified backup instead.');
        }
        Schema::dropIfExists('applicant_sessions');
    }
};
