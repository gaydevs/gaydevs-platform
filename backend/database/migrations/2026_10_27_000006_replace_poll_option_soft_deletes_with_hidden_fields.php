<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('poll_options', function (Blueprint $table): void {
            $table->renameColumn('deleted_at', 'hidden_at');
        });

        Schema::table('poll_options', function (Blueprint $table): void {
            $table->foreignUuid('hidden_by_user_id')->nullable()->after('hidden_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('poll_options', function (Blueprint $table): void {
            $table->dropForeign(['hidden_by_user_id']);
            $table->dropColumn('hidden_by_user_id');
        });

        Schema::table('poll_options', function (Blueprint $table): void {
            $table->renameColumn('hidden_at', 'deleted_at');
        });
    }
};
