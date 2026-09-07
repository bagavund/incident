<?php

namespace App\Services;

use App\Enums\EscalationKind;
use App\Enums\TimelineKind;
use App\Models\Incident;
use App\Support\Duration;

/**
 * Per-incident timing metrics, derived from the incident's timestamps, its
 * timeline steps and its escalation attempts. This is the single place the
 * numbers are computed — the frontend only renders them.
 */
class IncidentMetrics
{
    /**
     * @return array{
     *     to_detect: array{minutes:int|null,human:string|null},
     *     to_escalate: array{minutes:int|null,human:string|null},
     *     to_diagnose: array{minutes:int|null,human:string|null},
     *     to_resolve: array{minutes:int|null,human:string|null},
     *     stub_duration: array{minutes:int|null,human:string|null},
     *     escalation: array{
     *         total_calls:int,
     *         responsible_span: array{minutes:int|null,human:string|null},
     *         approval_span: array{minutes:int|null,human:string|null}
     *     }
     * }
     */
    public function for(Incident $incident): array
    {
        $incident->loadMissing(['timelineSteps', 'escalationAttempts']);

        $diagnosis = $incident->stepOfKind(TimelineKind::Diagnosis)?->occurred_at;
        $handedOff = $incident->handedOffAt();

        return [
            'to_detect' => Duration::payload(
                Duration::minutesBetween($incident->started_at, $incident->detected_at)
            ),
            'to_escalate' => Duration::payload(
                Duration::minutesBetween($incident->detected_at, $handedOff)
            ),
            'to_diagnose' => Duration::payload(
                Duration::minutesBetween($diagnosis, $handedOff)
            ),
            'to_resolve' => Duration::payload(
                Duration::minutesBetween($incident->started_at, $incident->resolved_at)
            ),
            'stub_duration' => Duration::payload($this->stubMinutes($incident)),
            'escalation' => [
                'total_calls' => (int) $incident->escalationAttempts->sum(fn ($e) => max(1, $e->attempts)),
                'responsible_span' => Duration::payload($this->spanMinutes($incident, EscalationKind::Responsible)),
                'approval_span' => Duration::payload($this->spanMinutes($incident, EscalationKind::Approval)),
            ],
        ];
    }

    /** Сколько провисела временная заглушка — от установки до снятия. */
    private function stubMinutes(Incident $incident): ?int
    {
        if (! $incident->stub_installed || ! $incident->stub_on || ! $incident->stub_off) {
            return null;
        }

        $on = Duration::anchorTime($incident->started_at, $incident->stub_on);
        $off = Duration::resolveClock($incident->started_at, $incident->stub_off, $on);

        return Duration::minutesBetween($on, $off);
    }

    /** Разброс между первой и последней попыткой эскалации данного типа. */
    private function spanMinutes(Incident $incident, EscalationKind $kind): ?int
    {
        $cursor = $incident->started_at;

        $times = $incident->escalationAttempts
            ->where('kind', $kind)
            ->sortBy('position')
            ->map(function ($attempt) use ($incident, &$cursor) {
                $at = Duration::resolveClock($incident->started_at, $attempt->time, $cursor);
                if ($at !== null) {
                    $cursor = $at;
                }

                return $at;
            })
            ->filter()
            ->values();

        if ($times->count() < 2) {
            return null;
        }

        return Duration::minutesBetween($times->first(), $times->last());
    }
}
