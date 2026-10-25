<?php

namespace App\Services;

class NameMasker
{
    public function mask(string $name, string $query = ''): string
    {
        $nameParts = array_values(array_filter(preg_split('/\s+/u', trim($name)) ?: []));
        $queryParts = array_values(array_filter(preg_split('/[\s.]+/u', trim($query)) ?: []));
        $visibleCharacters = array_fill(0, count($nameParts), 1);

        if (count($queryParts) === 1) {
            foreach ($nameParts as $index => $part) {
                if ($this->startsWith($part, $queryParts[0])) {
                    $visibleCharacters[$index] = min(mb_strlen($queryParts[0]), mb_strlen($part));
                }
            }
        } elseif ($queryParts !== []) {
            foreach ($queryParts as $index => $queryPart) {
                if (isset($nameParts[$index]) && $this->startsWith($nameParts[$index], $queryPart)) {
                    $visibleCharacters[$index] = min(mb_strlen($queryPart), mb_strlen($nameParts[$index]));
                }
            }
        }

        return collect($nameParts)
            ->map(function (string $part, int $index) use ($visibleCharacters): string {
                return mb_substr($part, 0, $visibleCharacters[$index])
                    .str_repeat('*', mb_strlen($part) - $visibleCharacters[$index]);
            })
            ->implode(' ');
    }

    private function startsWith(string $value, string $prefix): bool
    {
        return str_starts_with(mb_strtolower($value), mb_strtolower($prefix));
    }
}
