<?php

namespace App\Support;

use App\Enums\TimelineKind;
use App\Models\Incident;
use Illuminate\Support\Arr;

/**
 * Reconciles an incident's timeline_steps rows against an incoming array of
 * steps (from a create / update payload). Order in the array wins for `position`.
 */
final class TimelineSync
{
    /**
     * @param  array<int,array<string,mixed>>  $steps
     */
    public static function apply(Incident $incident, array $steps): void
    {
        $keptIds = [];

        foreach (array_values($steps) as $position => $raw) {
            $attributes = [
                'position' => $raw['position'] ?? $position,
                'kind' => $raw['kind'] ?? TimelineKind::HandedOff->value,
                'action' => $raw['action'] ?? null,
                'time' => $raw['time'] ?? null,
                'custom' => (bool) ($raw['custom'] ?? false),
            ];

            $id = Arr::get($raw, 'id');
            $step = $id
                ? $incident->timelineSteps()->whereKey($id)->first()
                : null;

            if ($step) {
                $step->update($attributes);
            } else {
                $step = $incident->timelineSteps()->create($attributes);
            }

            $keptIds[] = $step->id;
        }

        $incident->timelineSteps()->whereKeyNot($keptIds)->delete();
        $incident->load('timelineSteps');
    }

    /**
     * The four mandatory postmortem steps, empty, in canonical order.
     *
     * @return array<int,array<string,mixed>>
     */
    public static function defaultSteps(): array
    {
        return array_map(
            fn (TimelineKind $kind, int $i) => ['kind' => $kind->value, 'position' => $i, 'action' => null],
            TimelineKind::required(),
            array_keys(TimelineKind::required()),
        );
    }
}
