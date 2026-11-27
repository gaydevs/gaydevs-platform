<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            // Native ADD COLUMN retains the existing CHECK constraints on users.
            DB::statement('ALTER TABLE users ADD COLUMN applicant_id varchar(36) NULL REFERENCES applicants(id) ON DELETE RESTRICT');
            Schema::table('users', fn (Blueprint $table) => $table->unique('applicant_id'));

            return;
        }

        Schema::table('users', function (Blueprint $table): void {
            $table->foreignUuid('applicant_id')->nullable()->unique()->constrained('applicants')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        if (DB::table('users')->whereNotNull('applicant_id')->exists()) {
            throw new RuntimeException('Cannot remove member admission history. Restore a verified backup instead.');
        }

        if (DB::getDriverName() === 'sqlite') {
            Schema::table('users', fn (Blueprint $table) => $table->dropUnique(['applicant_id']));
            DB::statement('ALTER TABLE users DROP COLUMN applicant_id');

            return;
        }

        Schema::table('users', function (Blueprint $table): void {
            $table->dropForeign(['applicant_id']);
            $table->dropUnique(['applicant_id']);
            $table->dropColumn('applicant_id');
        });
    }
};
