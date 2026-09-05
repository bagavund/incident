<?php

namespace App\Support;

use App\Enums\EscalationChannel;
use App\Enums\EscalationKind;
use App\Enums\EscalationResult;
use App\Models\Incident;
use Illuminate\Support\Arr;

/**
 * Reconciles an incident's escalation_attempts rows against an incoming array
 * of attempts (from a create / update payload). Order in the array wins for `position`.
 */
final class EscalationSync
{
    /**
     * @param  array<int,array<string,mixed>>  $attempts
     */
    public static function apply(Incident $incident, array $attempts): void
    {
        $keptIds = [];

        foreach (array_values($attempts) as $position => $raw) {
            $attributes = [
                'position' => $raw['position'] ?? $position,
                'time' => $raw['time'] ?? null,
                'callee_name' => $raw['callee_name'] ?? null,
                'kind' => $raw['kind'] ?? EscalationKind::Responsible->value,
                'channel' => $raw['channel'] ?? EscalationChannel::Phone->value,
                'result' => $raw['result'] ?? EscalationResult::Reached->value,
                'attempts' => max(1, (int) ($raw['attempts'] ?? 1)),
            ];

            $id = Arr::get($raw, 'id');
            $attempt = $id
                ? $incident->escalationAttempts()->whereKey($id)->first()
                : null;

            if ($attempt) {
                $attempt->update($attributes);
            } else {
                $attempt = $incident->escalationAttempts()->create($attributes);
            }

            $keptIds[] = $attempt->id;
        }

        $incident->escalationAttempts()->whereKeyNot($keptIds)->delete();
        $incident->load('escalationAttempts');
    }
}
