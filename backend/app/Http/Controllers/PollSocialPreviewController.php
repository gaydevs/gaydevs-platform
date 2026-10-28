<?php

namespace App\Http\Controllers;

use App\Services\PollService;
use Illuminate\Contracts\View\View;

class PollSocialPreviewController extends Controller
{
    private const SITE_ORIGIN = 'https://vettoretti.dev';

    private const POLLS_PATH = '/gaydevs/platform/polls';

    private const IMAGE_URL = self::SITE_ORIGIN.'/gaydevs/platform/polls-preview.png';

    private const LIST_TITLE = '/gdevs/polls';

    private const LIST_DESCRIPTION = 'vote nas enquetes da comunidade, participe das decisões 🗳️';

    private const DETAIL_DESCRIPTION = 'vote e veja o que a comunidade gaydevs prefere 🗳️';

    public function __construct(private readonly PollService $polls) {}

    public function __invoke(?string $identifier = null): View
    {
        $title = self::LIST_TITLE;
        $description = self::LIST_DESCRIPTION;
        $canonicalUrl = self::SITE_ORIGIN.self::POLLS_PATH.'/';

        if ($identifier !== null) {
            $poll = $this->polls->resolve($identifier);
            $title = $poll->question;
            $description = self::DETAIL_DESCRIPTION;
            $canonicalUrl = self::SITE_ORIGIN.self::POLLS_PATH.'/'.rawurlencode($poll->slug);
        }

        return view('social.poll-preview', [
            'title' => $title,
            'description' => $description,
            'canonicalUrl' => $canonicalUrl,
            'imageUrl' => self::IMAGE_URL,
        ]);
    }
}
