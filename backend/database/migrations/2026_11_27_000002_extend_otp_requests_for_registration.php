<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        $this->alter(function (): void {
            Schema::table('otp_requests', function (Blueprint $table): void {
                $table->uuid('user_id')->nullable()->change();
                $table->string('email')->nullable();
                $table->string('purpose', 20)->default('login');
                $table->foreignUuid('applicant_id')->nullable()->constrained('applicants')->restrictOnDelete();
                $table->index(['purpose', 'user_id', 'status']);
                $table->index(['purpose', 'applicant_id', 'status']);
                $table->index(['purpose', 'email', 'status']);
            });

            // Existing rows have no recipient snapshot. Infer only when the current
            // user record strictly predates the request (same-second updates are ambiguous).
            DB::table('otp_requests')->join('users', 'users.id', '=', 'otp_requests.user_id')
                ->whereColumn('users.updated_at', '<', 'otp_requests.created_at')
                ->select('otp_requests.id', 'users.email')
                ->chunkById(500, function ($rows): void {
                    foreach ($rows as $row) {
                        DB::table('otp_requests')->where('id', $row->id)->update([
                            'email' => mb_strtolower(trim($row->email)),
                        ]);
                    }
                }, 'otp_requests.id', 'id');

            $this->addGuards();
        });
    }

    public function down(): void
    {
        if (DB::table('otp_requests')->where('purpose', '!=', 'login')
            ->orWhereNotNull('applicant_id')->orWhereNull('user_id')->exists()) {
            throw new RuntimeException('Cannot remove OTP registration history. Restore a verified backup instead.');
        }

        // Backfilled login recipients are redundant while the linked user's
        // normalized email still matches. Preserve distinct historical recipients.
        DB::table('otp_requests')->leftJoin('users', 'users.id', '=', 'otp_requests.user_id')
            ->whereNotNull('otp_requests.email')
            ->select('otp_requests.id', 'otp_requests.email', 'users.email as user_email')
            ->chunkById(500, function ($rows): void {
                foreach ($rows as $row) {
                    if ($row->user_email === null || $row->email !== mb_strtolower(trim($row->user_email))) {
                        throw new RuntimeException('Cannot remove OTP recipient history. Restore a verified backup instead.');
                    }
                }
            }, 'otp_requests.id', 'id');

        $this->alter(function (): void {
            foreach (['insert', 'update'] as $operation) {
                DB::unprepared('DROP TRIGGER IF EXISTS otp_requests_subject_'.$operation);
            }

            Schema::table('otp_requests', function (Blueprint $table): void {
                $table->dropForeign(['applicant_id']);
                $table->dropIndex(['purpose', 'user_id', 'status']);
                $table->dropIndex(['purpose', 'applicant_id', 'status']);
                $table->dropIndex(['purpose', 'email', 'status']);
                $table->dropColumn(['email', 'purpose', 'applicant_id']);
                $table->uuid('user_id')->nullable(false)->change();
            });
        });
    }

    private function alter(Closure $callback): void
    {
        if (DB::getDriverName() === 'sqlite') {
            Schema::withoutForeignKeyConstraints(function () use ($callback): void {
                DB::transaction(function () use ($callback): void {
                    $callback();
                    if (DB::select('PRAGMA foreign_key_check') !== []) {
                        throw new RuntimeException('OTP migration violated foreign key integrity.');
                    }
                });
            });

            return;
        }

        $callback();
    }

    private function addGuards(): void
    {
        foreach (['insert', 'update'] as $operation) {
            $predicate = <<<'SQL'
                (NEW.purpose NOT IN ('login', 'registration')
                OR (NEW.purpose = 'login' AND (NEW.user_id IS NULL OR NEW.applicant_id IS NOT NULL))
                OR (NEW.purpose = 'registration' AND (
                    (NEW.user_id IS NULL AND NEW.applicant_id IS NULL)
                    OR (NEW.user_id IS NOT NULL AND NEW.applicant_id IS NOT NULL)
                    OR NEW.email IS NULL
                ))
                OR (NEW.email IS NOT NULL AND LENGTH(TRIM(NEW.email)) = 0))
                SQL;
            if ($operation === 'insert') {
                $predicate .= ' OR NEW.email IS NULL';
            } else {
                $predicate .= ' OR NEW.purpose <> OLD.purpose';
                $predicate .= DB::getDriverName() === 'sqlite'
                    ? ' OR NEW.email IS NOT OLD.email OR NEW.user_id IS NOT OLD.user_id'
                    : ' OR NOT (NEW.email <=> OLD.email) OR NOT (NEW.user_id <=> OLD.user_id)';
            }
            $name = 'otp_requests_subject_'.$operation;
            $event = strtoupper($operation);

            if (DB::getDriverName() === 'sqlite') {
                DB::unprepared("CREATE TRIGGER {$name} BEFORE {$event} ON otp_requests FOR EACH ROW WHEN {$predicate} BEGIN SELECT RAISE(ABORT, 'Invalid OTP subject'); END");
            } else {
                DB::unprepared("CREATE TRIGGER {$name} BEFORE {$event} ON otp_requests FOR EACH ROW BEGIN IF {$predicate} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid OTP subject'; END IF; END");
            }
        }
    }
};
