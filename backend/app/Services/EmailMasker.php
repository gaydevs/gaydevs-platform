<?php

namespace App\Services;

class EmailMasker
{
    public function mask(string $email, string $query = ''): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
        $term = trim($query);

        $maskedLocal = $this->maskLocal($local, $term);
        $domainParts = explode('.', $domain);
        $suffix = count($domainParts) > 1 ? array_pop($domainParts) : null;
        $maskedDomain = collect($domainParts)
            ->map(fn (string $part): string => $this->maskPart($part))
            ->implode('.');

        if ($maskedDomain === '' && $suffix !== null) {
            $maskedDomain = $this->maskPart($suffix);
            $suffix = null;
        }

        return $maskedLocal.'@'.$maskedDomain.($suffix === null ? '' : '.'.$suffix);
    }

    private function maskLocal(string $local, string $query): string
    {
        $localParts = array_values(array_filter(
            preg_split('/[^\pL\pN]+/u', $local) ?: [],
            fn (string $part): bool => $part !== '',
        ));
        $queryParts = array_values(array_filter(
            preg_split('/[^\pL\pN]+/u', $query) ?: [],
            fn (string $part): bool => $part !== '',
        ));
        $visibleCharacters = array_fill(0, count($localParts), 1);
        $partOrder = array_keys($localParts);

        if (count($queryParts) === 1) {
            foreach ($localParts as $index => $part) {
                if ($this->startsWith($part, $queryParts[0])) {
                    $visibleCharacters[$index] = min(mb_strlen($queryParts[0]), mb_strlen($part));
                }
            }
        } elseif ($queryParts !== []) {
            $matchedIndexes = [];

            foreach ($queryParts as $queryPart) {
                $matchedIndex = collect($localParts)->search(
                    fn (string $part, int $index): bool => ! in_array($index, $matchedIndexes, true)
                        && $this->startsWith($part, $queryPart),
                );

                if ($matchedIndex === false) {
                    $matchedIndexes = [];

                    break;
                }

                $matchedIndexes[] = $matchedIndex;
                $visibleCharacters[$matchedIndex] = min(mb_strlen($queryPart), mb_strlen($localParts[$matchedIndex]));
            }

            if ($matchedIndexes !== []) {
                $partOrder = [
                    ...$matchedIndexes,
                    ...array_values(array_diff(array_keys($localParts), $matchedIndexes)),
                ];
            }
        }

        if ($partOrder !== array_keys($localParts)) {
            return collect($partOrder)
                ->map(fn (int $index): string => $this->maskPartPrefix(
                    $localParts[$index],
                    $visibleCharacters[$index],
                ))
                ->implode('.');
        }

        $partIndex = 0;

        return collect(preg_split('/([^\pL\pN]+)/u', $local, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY) ?: [])
            ->map(function (string $part) use (&$partIndex, $visibleCharacters): string {
                if (preg_match('/^[\pL\pN]+$/u', $part) !== 1) {
                    return $part;
                }

                return $this->maskPartPrefix($part, $visibleCharacters[$partIndex++]);
            })
            ->implode('');
    }

    private function maskPartPrefix(string $part, int $visibleCharacters): string
    {
        return mb_substr($part, 0, $visibleCharacters)
            .str_repeat('*', mb_strlen($part) - $visibleCharacters);
    }

    private function maskPart(string $value): string
    {
        if ($value === '') {
            return '***';
        }

        return mb_substr($value, 0, 1)
            .str_repeat('*', mb_strlen($value) - 1);
    }

    private function startsWith(string $value, string $prefix): bool
    {
        return str_starts_with(mb_strtolower($value), mb_strtolower($prefix));
    }
}
