<?php

namespace App\Services;

use App\Enums\TimelineKind;
use App\Models\Incident;
use App\Support\Duration;

/**
 * Per-incident timing metrics, derived from the incident's timestamps and its
 * timeline steps. Mirrors the numbers the frontend computes client-side.
 */
class IncidentMetrics
{
    /**
     * @return array{
     *     to_detect: array{minutes:int|null,human:string|null},
     *     to_diagnose: array{minutes:int|null,human:string|null},
     *     to_resolve: array{minutes:int|null,human:string|null}
     * }
     */
    public function for(Incident $incident): array
    {
        $incident->loadMissing('timelineSteps');

        $diagnosis = Duration::anchorTime($incident->started_at, $incident->stepOfKind(TimelineKind::Diagnosis)?->time);
        $handedOff = Duration::anchorTime($incident->started_at, $incident->stepOfKind(TimelineKind::HandedOff)?->time);

        return [
            'to_detect' => Duration::payload(
                Duration::minutesBetween($incident->started_at, $incident->detected_at)
            ),
            'to_diagnose' => Duration::payload(
                Duration::minutesBetween($diagnosis, $handedOff)
            ),
            'to_resolve' => Duration::payload(
                Duration::minutesBetween($incident->started_at, $incident->resolved_at)
            ),
        ];
    }
}
