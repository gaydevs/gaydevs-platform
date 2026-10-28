<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('polls', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('created_by_user_id')->constrained('users');
            $table->string('question');
            $table->string('slug', 120)->unique();
            $table->timestamp('started_at')->nullable();
            $table->date('started_on')->nullable();
            $table->boolean('allow_multiple')->default(false);
            $table->boolean('allow_new_options')->default(false);
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index('closed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('polls');
    }
};
