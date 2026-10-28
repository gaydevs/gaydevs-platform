<?php

namespace App\Http\Controllers;

use App\Services\PollService;
use Illuminate\Contracts\View\View;

class PollSocialPreviewController extends Controller
{
    private const LIST_TITLE = '/gdevs/polls';

    private const LIST_DESCRIPTION = 'vote nas enquetes da comunidade, participe das decisões 🗳️';

    private const DETAIL_DESCRIPTION = 'vote e veja o que a comunidade gaydevs prefere 🗳️';

    public function __construct(private readonly PollService $polls) {}

    public function __invoke(?string $identifier = null): View
    {
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');
        abort_if($frontendUrl === '', 500, 'APP_FRONTEND_URL is not configured.');

        $title = self::LIST_TITLE;
        $description = self::LIST_DESCRIPTION;
        $canonicalUrl = $frontendUrl.'/polls/';

        if ($identifier !== null) {
            $poll = $this->polls->resolve($identifier);
            $title = $poll->question;
            $description = self::DETAIL_DESCRIPTION;
            $canonicalUrl = $frontendUrl.'/polls/'.rawurlencode($poll->slug);
        }

        return view('social.poll-preview', [
            'title' => $title,
            'description' => $description,
            'canonicalUrl' => $canonicalUrl,
            'imageUrl' => $frontendUrl.'/polls-preview.png',
        ]);
    }
}
