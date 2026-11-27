<?php

use App\Enums\OtpPurpose;
use App\Models\OtpRequest;
use App\Models\User;
use App\Models\VisitorObservation;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\Support\IsolatedApplicationDatabase;

test('upgrade preserves legacy OTP history and does not invent recipients after a user update', function () {
    $isolated = new IsolatedApplicationDatabase('application_upgrade_test', ':memory:');

    try {
        $paths = glob(database_path('migrations/*.php'));
        foreach ($paths as $path) {
            if (basename($path) >= '2026_11_27_000002') {
                continue;
            }
            (require $path)->up();
        }

        $observation = VisitorObservation::factory()->create();
        $first = User::factory()->create(['email' => 'Old@Example.com', 'created_at' => now()->subDays(5), 'updated_at' => now()->subDays(5)]);
        $changed = User::factory()->create(['email' => 'Changed@Example.com', 'created_at' => now()->subDays(5), 'updated_at' => now()]);
        $insertOtp = function (User $user) use ($observation): string {
            $id = (string) Str::uuid7();
            DB::table('otp_requests')->insert([
                'id' => $id,
                'user_id' => $user->id,
                'visitor_observation_id' => $observation->id,
                'code_hash' => Hash::make('123456'),
                'status' => 'used',
                'expires_at' => now()->subDays(2)->addMinutes(10),
                'accepted_at' => now()->subDays(2),
                'created_at' => now()->subDays(2),
                'updated_at' => now()->subDays(2),
            ]);

            return $id;
        };
        $firstOtp = $insertOtp($first);
        $changedOtp = $insertOtp($changed);
        DB::table('otp_requests')->where('id', $changedOtp)->update(['superseded_by_id' => $firstOtp]);
        $attemptId = DB::table('otp_attempts')->insertGetId([
            'otp_request_id' => $firstOtp,
            'matched_otp_request_id' => $changedOtp,
            'visitor_observation_id' => $observation->id,
            'authenticated_user_id' => $first->id,
            'result' => 'accepted',
            'attempted_at' => now()->subDays(2),
        ]);

        $otpMigration = require database_path('migrations/2026_11_27_000002_extend_otp_requests_for_registration.php');
        $userMigration = require database_path('migrations/2026_11_27_000003_add_applicant_id_to_users_table.php');
        $otpMigration->up();
        $userMigration->up();

        expect(OtpRequest::findOrFail($firstOtp)->purpose)->toBe(OtpPurpose::Login)
            ->and(OtpRequest::findOrFail($firstOtp)->email)->toBe('old@example.com')
            ->and(OtpRequest::findOrFail($changedOtp)->email)->toBeNull()
            ->and(OtpRequest::findOrFail($changedOtp)->superseded_by_id)->toBe($firstOtp)
            ->and(DB::table('otp_attempts')->find($attemptId)->matched_otp_request_id)->toBe($changedOtp)
            ->and(DB::table('otp_attempts')->find($attemptId)->authenticated_user_id)->toBe($first->id)
            ->and($first->refresh()->applicant_id)->toBeNull();
        if ($isolated->driver === 'sqlite') {
            expect(DB::select('PRAGMA foreign_key_check'))->toBe([]);
        }
        expect(fn () => User::factory()->create(['status' => 'invalid']))->toThrow(QueryException::class);
        // A changed recipient is independent historical information.
        DB::table('users')->where('id', $first->id)->update(['email' => 'different@example.com']);
        expect(fn () => $otpMigration->down())->toThrow(RuntimeException::class, 'Cannot remove OTP recipient history');
        DB::table('users')->where('id', $first->id)->update(['email' => 'Old@Example.com']);

        // Even registration for an existing member is not representable as a legacy login.
        $registration = (array) DB::table('otp_requests')->find($firstOtp);
        $registration['id'] = (string) Str::uuid7();
        $registration['purpose'] = 'registration';
        DB::table('otp_requests')->insert($registration);
        expect(fn () => $otpMigration->down())->toThrow(RuntimeException::class, 'Cannot remove OTP registration history');
        DB::table('otp_requests')->where('id', $registration['id'])->delete();

        // Immediate rollback on a populated legacy database keeps all original history.
        $userMigration->down();
        $otpMigration->down();
        expect(DB::table('otp_requests')->count())->toBe(2)
            ->and(DB::table('otp_requests')->find($firstOtp)->user_id)->toBe($first->id)
            ->and(DB::table('otp_requests')->find($changedOtp)->superseded_by_id)->toBe($firstOtp)
            ->and(DB::table('otp_attempts')->find($attemptId)->matched_otp_request_id)->toBe($changedOtp)
            ->and(DB::table('otp_attempts')->find($attemptId)->authenticated_user_id)->toBe($first->id)
            ->and(Schema::hasColumn('otp_requests', 'email'))->toBeFalse();
        if ($isolated->driver === 'sqlite') {
            expect(DB::select('PRAGMA foreign_key_check'))->toBe([]);
        }
        $otpMigration->up();
        $userMigration->up();
        expect(OtpRequest::findOrFail($firstOtp)->email)->toBe('old@example.com')
            ->and(DB::table('otp_attempts')->count())->toBe(1);
    } finally {
        $isolated->close();
    }
});
