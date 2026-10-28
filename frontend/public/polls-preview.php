<?php

declare(strict_types=1);

const POLLS_SITE_ORIGIN = 'https://vettoretti.dev';
const POLLS_PATH = '/gaydevs/platform/polls';
const POLLS_API_PATH = '/gaydevs/api/polls/';
const POLLS_IMAGE_URL = POLLS_SITE_ORIGIN.'/gaydevs/platform/polls-preview.png';
const POLLS_LIST_TITLE = '/gdevs/polls';
const POLLS_LIST_DESCRIPTION = 'vote nas enquetes da comunidade, participe das decisões 🗳️';
const POLLS_DETAIL_DESCRIPTION = 'vote e veja o que a comunidade gaydevs prefere 🗳️';

function polls_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function polls_slug_from_request(): ?string
{
    $requestPath = parse_url($_SERVER['REQUEST_URI'] ?? POLLS_PATH, PHP_URL_PATH);
    if (! is_string($requestPath) || ! str_starts_with($requestPath, POLLS_PATH)) {
        return null;
    }

    $suffix = trim(substr($requestPath, strlen(POLLS_PATH)), '/');
    if ($suffix === '' || ! preg_match('/^[a-z0-9-]+$/', $suffix)) {
        return null;
    }

    return $suffix;
}

function polls_fetch_question(string $slug): ?string
{
    $url = POLLS_SITE_ORIGIN.POLLS_API_PATH.rawurlencode($slug);
    $body = false;
    $status = 0;

    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        if ($curl === false) {
            return null;
        }

        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 1,
            CURLOPT_TIMEOUT => 2,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_USERAGENT => 'gaydevs-social-preview/1.0',
        ]);
        $body = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);
    } else {
        $context = stream_context_create([
            'http' => [
                'timeout' => 2,
                'ignore_errors' => true,
                'header' => "Accept: application/json\r\nUser-Agent: gaydevs-social-preview/1.0\r\n",
            ],
        ]);
        $body = @file_get_contents($url, false, $context);
        foreach ($http_response_header ?? [] as $header) {
            if (preg_match('/^HTTP\/\S+\s+(\d{3})/', $header, $matches)) {
                $status = (int) $matches[1];
            }
        }
    }

    if ($status !== 200 || ! is_string($body)) {
        return null;
    }

    $payload = json_decode($body, true);
    $question = $payload['poll']['question'] ?? null;

    return is_string($question) && trim($question) !== '' ? trim($question) : null;
}

$slug = polls_slug_from_request();
$title = POLLS_LIST_TITLE;
$description = POLLS_LIST_DESCRIPTION;
$canonicalUrl = POLLS_SITE_ORIGIN.POLLS_PATH.'/';

if ($slug !== null) {
    $description = POLLS_DETAIL_DESCRIPTION;
    $canonicalUrl = POLLS_SITE_ORIGIN.POLLS_PATH.'/'.rawurlencode($slug);
    $question = polls_fetch_question($slug);
    if ($question !== null) {
        $title = $question;
    }
}

$indexPath = __DIR__.'/index.html';
$html = @file_get_contents($indexPath);
if (! is_string($html)) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Frontend indisponível.';
    exit;
}

$meta = sprintf(
    "    <meta property=\"og:title\" content=\"%s\" />\n".
    "    <meta property=\"og:description\" content=\"%s\" />\n".
    "    <meta property=\"og:image\" content=\"%s\" />\n".
    "    <meta property=\"og:image:type\" content=\"image/png\" />\n".
    "    <meta property=\"og:image:width\" content=\"1024\" />\n".
    "    <meta property=\"og:image:height\" content=\"1024\" />\n".
    "    <meta property=\"og:image:alt\" content=\"/gdevs/polls\" />\n".
    "    <meta property=\"og:type\" content=\"website\" />\n".
    "    <meta property=\"og:url\" content=\"%s\" />\n".
    "    <meta name=\"twitter:card\" content=\"summary\" />\n".
    "    <meta name=\"twitter:title\" content=\"%s\" />\n".
    "    <meta name=\"twitter:description\" content=\"%s\" />\n".
    "    <meta name=\"twitter:image\" content=\"%s\" />\n".
    "    <meta name=\"twitter:image:alt\" content=\"/gdevs/polls\" />\n",
    polls_escape($title),
    polls_escape($description),
    polls_escape(POLLS_IMAGE_URL),
    polls_escape($canonicalUrl),
    polls_escape($title),
    polls_escape($description),
    polls_escape(POLLS_IMAGE_URL),
);

$html = str_replace('  </head>', $meta.'  </head>', $html, $count);
if ($count !== 1) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Frontend indisponível.';
    exit;
}

header('Content-Type: text/html; charset=UTF-8');
echo $html;
