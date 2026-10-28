<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_preferences', function (Blueprint $table): void {
            $table->foreignUuid('user_id')->primary()->constrained('users');
            $table->json('settings');
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_preferences');
    }
};
