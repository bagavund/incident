<?php

namespace App\Http\Resources;

use App\Models\TimelineStep;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin TimelineStep */
class TimelineStepResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'position' => $this->position,
            'kind' => $this->kind->value,
            'kind_label' => $this->kind->label(),
            'action' => $this->action,
            'time' => $this->time,
            'custom' => $this->custom,
        ];
    }
}
