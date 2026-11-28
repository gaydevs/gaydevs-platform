<?php

namespace App\Http\Controllers;

use App\Enums\ApplicantStatus;
use App\Enums\MemberType;
use App\Models\Applicant;
use App\Models\User;
use App\Services\ApplicantLifecycle;
use App\Services\ApplicationData;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class AdminApplicationController extends Controller
{
    public function __construct(private ApplicantLifecycle $lifecycle, private ApplicationData $data) {}

    public function index(): Response
    {
        $page = Applicant::query()->where('status', ApplicantStatus::Pending)->orderBy('submitted_at')->orderBy('id')->paginate(20);
        $page->through(fn (Applicant $a) => [
            'id' => $a->id, 'first_name' => $a->first_name, 'last_name' => $a->last_name,
            'submitted_at' => $a->submitted_at?->toIso8601String(), 'status' => $a->status->value,
        ]);

        return response()->json($page);
    }

    public function show(string $id): Response
    {
        return response()->json($this->detail($this->find($id)));
    }

    public function notes(Request $request, string $id): Response
    {
        $data = $request->validate(['admin_notes' => ['present', 'nullable', 'string', 'max:10000'], 'revision' => ['required', 'integer', 'min:0']]);
        $applicant = $this->find($id);
        $current = $this->lifecycle->withEmailLock($applicant->email, fn () => DB::transaction(function () use ($request, $id, $data): Applicant {
            $current = Applicant::query()->lockForUpdate()->findOrFail($id);
            $actor = User::query()->lockForUpdate()->find($request->user()->id);
            abort_unless($actor?->status === User::STATUS_ACTIVE && $actor->member_type === MemberType::ADMIN, 403);
            if ($current->status !== ApplicantStatus::Pending || $current->revision !== (int) $data['revision']) {
                throw new ConflictHttpException('Candidatura alterada. Atualize a página.');
            }
            $current->forceFill(['admin_notes' => $data['admin_notes'], 'revision' => $current->revision + 1])->save();
            $current->events()->create(['event_key' => 'notes:'.$current->revision, 'event_type' => 'notes_updated', 'occurred_at' => now(), 'actor_user_id' => $actor->id]);

            return $current;
        }, 3));

        return response()->json($this->detail($current));
    }

    public function approve(Request $request, string $id): Response
    {
        $a = $this->find($id);
        $member = $this->lifecycle->approve($a, $request->user());

        return response()->json(['status' => 'approved', 'user_id' => $member->id]);
    }

    public function reject(Request $request, string $id): Response
    {
        $a = $this->lifecycle->reject($this->find($id), $request->user());

        return response()->json(['status' => $a->status->value]);
    }

    private function find(string $id): Applicant
    {
        return Applicant::query()->whereIn('status', [ApplicantStatus::Pending, ApplicantStatus::Approved, ApplicantStatus::Rejected])->findOrFail($id);
    }

    private function detail(Applicant $a): array
    {
        return [
            'id' => $a->id, 'status' => $a->status->value, 'revision' => $a->revision,
            'fields' => $this->data->fields($a),
            'whatsapp_url' => $a->whatsapp ? 'https://wa.me/'.ltrim($a->whatsapp, '+') : null,
            'consents' => $a->consents()->orderBy('accepted_at')->get(['consent_key', 'version', 'accepted_at']),
            'admin_notes' => $a->admin_notes,
            'submitted_at' => $a->submitted_at?->toIso8601String(),
            'reviewed_at' => $a->reviewed_at?->toIso8601String(),
            'reviewed_by' => $a->reviewed_by,
            'notification_status' => DB::table('application_notifications')->where('applicant_id', $a->id)->value('status'),
        ];
    }
}
