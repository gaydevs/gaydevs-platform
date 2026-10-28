<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('poll_options', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('poll_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('label');
            $table->softDeletes();
            $table->timestamps();

            $table->index(['poll_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('poll_options');
    }
};
