<?php

namespace App\Support;

use Carbon\CarbonInterface;

final class Duration
{
    /**
     * Human-readable minutes: 42 -> "42м", 167 -> "2ч 47м", 120 -> "2ч".
     */
    public static function human(?int $minutes): ?string
    {
        if ($minutes === null) {
            return null;
        }

        $minutes = max(0, $minutes);

        if ($minutes < 60) {
            return "{$minutes}м";
        }

        $h = intdiv($minutes, 60);
        $m = $minutes % 60;

        return $m ? "{$h}ч {$m}м" : "{$h}ч";
    }

    public static function minutesBetween(?CarbonInterface $from, ?CarbonInterface $to): ?int
    {
        if (! $from || ! $to) {
            return null;
        }

        return (int) round($from->diffInSeconds($to, false) / 60);
    }

    /** Anchors a "HH:MM" timeline-step time onto the same calendar day as $base. */
    public static function anchorTime(?CarbonInterface $base, ?string $time): ?CarbonInterface
    {
        if (! $base || ! $time || ! preg_match('/^(\d{1,2}):(\d{2})$/', $time, $m)) {
            return null;
        }

        return $base->copy()->setTime((int) $m[1], (int) $m[2]);
    }

    /**
     * Resolves a "HH:MM" clock time into a full timestamp: anchored to $base's
     * calendar day, then rolled forward whole days until it is not earlier than
     * $notBefore. Lets a sequence of times that wraps past midnight stay
     * monotonic without the caller tracking day offsets.
     */
    public static function resolveClock(?CarbonInterface $base, ?string $time, ?CarbonInterface $notBefore = null): ?CarbonInterface
    {
        $at = self::anchorTime($base, $time);

        if ($at === null || $notBefore === null) {
            return $at;
        }

        while ($at->lessThan($notBefore)) {
            $at = $at->addDay();
        }

        return $at;
    }

    /** @return array{minutes:int|null,human:string|null} */
    public static function payload(?int $minutes): array
    {
        return ['minutes' => $minutes, 'human' => self::human($minutes)];
    }
}
