<?php

namespace App\Services;

use App\Mail\ApplicationSubmittedMail;
use App\Models\Applicant;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class ApplicationNotifications
{
    public function __construct(private ApplicationRateLimiter $limits, private EmailSender $sender) {}

    // Invoked only inside submission transaction.
    public function enqueue(Applicant $applicant): void
    {
        DB::table('application_notifications')->insert([
            'applicant_id' => $applicant->id,
            'status' => 'pending',
            'available_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function process(): int
    {
        $recipient = config('mail.from.address');
        $base = rtrim((string) config('app.frontend_url'), '/');
        if (! filter_var($recipient, FILTER_VALIDATE_EMAIL)
            || ! ApplicationAvailability::frontendUrlConfigured($base)
            || (app()->environment('production') && in_array(config('mail.default'), ['log', 'array'], true))) {
            Log::channel('operational')->error('applications.notification_configuration_invalid');

            return 0;
        }

        return Cache::lock('application:notification-worker', 120)->get(function () use ($recipient, $base): int {
            // A crashed process may already have delivered the message.
            DB::table('application_notifications')->where('status', 'sending')
                ->where('claimed_at', '<', now()->subMinutes(15))
                ->update(['status' => 'unknown', 'updated_at' => now()]);
            $sent = 0;
            $ids = DB::table('application_notifications')->where('status', 'pending')
                ->where('available_at', '<=', now())->orderBy('available_at')->limit(10)->pluck('applicant_id');
            foreach ($ids as $id) {
                $claimed = DB::table('application_notifications')->where('applicant_id', $id)->where('status', 'pending')
                    ->update(['status' => 'sending', 'claimed_at' => now(), 'updated_at' => now(), 'attempts' => DB::raw('attempts + 1')]);
                if ($claimed !== 1) {
                    continue;
                }
                try {
                    $this->limits->mail();
                } catch (Throwable) {
                    // No SMTP call occurred. Only retry this provably pre-send failure.
                    $attempts = DB::table('application_notifications')->where('applicant_id', $id)->value('attempts');
                    DB::table('application_notifications')->where('applicant_id', $id)->where('status', 'sending')
                        ->update(['status' => $attempts >= 10 ? 'failed' : 'pending', 'available_at' => now()->addHour(), 'updated_at' => now()]);
                    break;
                }
                try {
                    $this->sender->sendReserved($recipient, new ApplicationSubmittedMail($base.'/admin/applications/'.$id));
                } catch (Throwable) {
                    DB::table('application_notifications')->where('applicant_id', $id)->where('status', 'sending')
                        ->update(['status' => 'unknown', 'updated_at' => now()]);
                    Log::channel('operational')->error('applications.notification_delivery_unknown');

                    continue;
                }
                DB::table('application_notifications')->where('applicant_id', $id)->where('status', 'sending')
                    ->update(['status' => 'sent', 'sent_at' => now(), 'updated_at' => now()]);
                $sent++;
            }

            return $sent;
        }) ?? 0;
    }
}
