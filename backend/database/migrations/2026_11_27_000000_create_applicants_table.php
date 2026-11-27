<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('applicants', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('email');
            $table->enum('status', ['unverified', 'draft', 'pending', 'approved', 'rejected'])->default('unverified');
            $table->string('active_email')->nullable()->storedAs(
                "CASE WHEN status IN ('unverified', 'draft', 'pending') THEN email ELSE NULL END",
            )->unique();
            $table->string('first_name', 100)->nullable();
            $table->string('last_name', 100)->nullable();
            $table->string('whatsapp', 16)->nullable();
            $table->string('linkedin', 2048)->nullable();
            $table->string('github', 2048)->nullable();
            $table->string('instagram', 2048)->nullable();
            $table->string('referral_source')->nullable();
            $table->boolean('collaboration_interest')->nullable();
            $table->timestamp('github_skip_confirmed_at')->nullable();
            $table->string('current_step', 32)->default('email');
            $table->unsignedInteger('revision')->default(0);
            $table->timestamp('email_verified_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignUuid('reviewed_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->text('admin_notes')->nullable();
            $table->timestamps();

            $table->index(['email', 'created_at']);
            $table->index(['status', 'submitted_at', 'id']);
        });
    }

    public function down(): void
    {
        if (DB::table('applicants')->exists()) {
            throw new RuntimeException('Cannot remove application history. Restore a verified backup instead.');
        }

        Schema::dropIfExists('applicants');
    }
};
