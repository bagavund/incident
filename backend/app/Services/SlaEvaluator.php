<?php

namespace App\Services;

use App\Enums\IncidentSla;
use App\Models\Incident;
use App\Models\SlaSetting;
use App\Support\Duration;

/**
 * Вердикт по SLA выносит сервер, а не клиент: это то самое число, ради
 * которого систему и заводили, поэтому оно не может приходить из браузера.
 *
 * SLA здесь — это время реакции: от обнаружения до передачи ответственным
 * (эскалации), а не время до полного решения. Порог общий для всех
 * инцидентов и настраивается администратором (SlaSetting), а не привязан
 * к критичности. Пока эскалации не было, выносить вердикт рано — он ещё
 * не нарушен.
 */
class SlaEvaluator
{
    public function for(Incident $incident): IncidentSla
    {
        $minutes = Duration::minutesBetween($incident->detected_at, $incident->handedOffAt());

        if ($minutes === null) {
            return IncidentSla::Met;
        }

        return $minutes <= SlaSetting::current()->escalation_minutes
            ? IncidentSla::Met
            : IncidentSla::Breached;
    }
}
