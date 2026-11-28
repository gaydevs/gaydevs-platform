<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('application_notifications', function (Blueprint $table): void {
            $table->foreignUuid('applicant_id')->primary()->constrained('applicants')->restrictOnDelete();
            $table->string('status', 16)->default('pending');
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestamp('available_at');
            $table->timestamp('claimed_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'available_at']);
        });
    }

    public function down(): void
    {
        if (DB::table('application_notifications')->exists()) {
            throw new RuntimeException('Cannot remove application notification history.');
        }
        Schema::dropIfExists('application_notifications');
    }
};
