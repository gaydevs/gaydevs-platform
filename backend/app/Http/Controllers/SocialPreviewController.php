<?php

namespace App\Http\Controllers;

use App\Models\Poll;
use App\Services\Polls\PollReadService;
use Illuminate\Contracts\View\View;

class SocialPreviewController extends Controller
{
    private const DEFAULT_TITLE = 'gaydevs — uma comunidade para gays 🌈 e devs 💻';

    private const DEFAULT_DESCRIPTION = 'uma comunidade para gays 🌈 e devs 💻 — tecnologia, carreira, amizade, eventos e os surtos da vida dev.';

    private const POLLS_LIST_TITLE = '/gdevs/polls';

    private const POLLS_LIST_DESCRIPTION = 'vote nas enquetes da comunidade, participe das decisões 🗳️';

    private const POLLS_DETAIL_DESCRIPTION = 'vote e veja o que a comunidade gaydevs prefere 🗳️';

    public function __construct(private readonly PollReadService $polls) {}

    public function __invoke(?string $path = null): View
    {
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');
        abort_if($frontendUrl === '', 500, 'APP_FRONTEND_URL is not configured.');

        $path = trim((string) $path, '/');
        $preview = $this->defaultPreview($frontendUrl, $path);

        if ($path === 'polls' || str_starts_with($path, 'polls/')) {
            $preview = $this->pollPreview($frontendUrl, $path);
        }

        return view('social.preview', $preview);
    }

    /** @return array<string, int|string> */
    private function defaultPreview(string $frontendUrl, string $path): array
    {
        return [
            'title' => self::DEFAULT_TITLE,
            'description' => self::DEFAULT_DESCRIPTION,
            'canonicalUrl' => $this->canonicalUrl($frontendUrl, $path),
            'imageUrl' => $frontendUrl.'/brand-icon-512.png',
            'imageWidth' => 512,
            'imageHeight' => 512,
            'imageAlt' => 'gaydevs',
        ];
    }

    /** @return array<string, int|string> */
    private function pollPreview(string $frontendUrl, string $path): array
    {
        if (preg_match('/\Apolls\/([a-z0-9-]+)\z/', $path, $matches) === 1) {
            $poll = $this->polls->findBySlug($matches[1]);
            if ($poll !== null) {
                return $this->pollDetailPreview($frontendUrl, $poll);
            }
        }

        return $this->pollListPreview($frontendUrl);
    }

    /** @return array<string, int|string> */
    private function pollListPreview(string $frontendUrl): array
    {
        return [
            'title' => self::POLLS_LIST_TITLE,
            'description' => self::POLLS_LIST_DESCRIPTION,
            'canonicalUrl' => $frontendUrl.'/polls/',
            'imageUrl' => $frontendUrl.'/polls-preview.png',
            'imageWidth' => 1024,
            'imageHeight' => 1024,
            'imageAlt' => '/gdevs/polls',
        ];
    }

    /** @return array<string, int|string> */
    private function pollDetailPreview(string $frontendUrl, Poll $poll): array
    {
        return [
            'title' => $poll->question,
            'description' => self::POLLS_DETAIL_DESCRIPTION,
            'canonicalUrl' => $frontendUrl.'/polls/'.rawurlencode($poll->slug),
            'imageUrl' => $frontendUrl.'/polls-preview.png',
            'imageWidth' => 1024,
            'imageHeight' => 1024,
            'imageAlt' => '/gdevs/polls',
        ];
    }

    private function canonicalUrl(string $frontendUrl, string $path): string
    {
        if ($path === '') {
            return $frontendUrl.'/';
        }

        $segments = array_map(rawurlencode(...), explode('/', $path));

        return $frontendUrl.'/'.implode('/', $segments);
    }
}
