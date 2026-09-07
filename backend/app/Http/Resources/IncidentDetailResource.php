<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\SerializesEnum;
use App\Models\Incident;
use App\Services\IncidentMetrics;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Incident */
class IncidentDetailResource extends JsonResource
{
    use SerializesEnum;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'title' => $this->title,

            'services' => $this->whenLoaded('services', fn () => $this->services->map(fn ($s) => [
                'id' => $s->id,
                'name' => $s->name,
            ])),
            'author' => $this->whenLoaded('author', fn () => $this->author ? [
                'id' => $this->author->id,
                'name' => $this->author->name,
            ] : null),
            'on_duty' => $this->whenLoaded('onDuty', fn () => $this->onDuty ? [
                'id' => $this->onDuty->id,
                'name' => $this->onDuty->name,
            ] : null),

            'type' => $this->type,
            'criticality' => $this->criticality,
            'status' => $this->enum($this->status),
            'sla' => $this->enum($this->sla),

            'started_at' => $this->started_at?->toIso8601String(),
            'detected_at' => $this->detected_at?->toIso8601String(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),

            'stub' => $this->stub_installed ? [
                'installed' => true,
                'on' => $this->stub_on,
                'off' => $this->stub_off,
            ] : null,

            'cause' => $this->cause,
            'impact' => $this->impact,
            'task_link' => $this->task_link,
            'zones' => $this->zones ?? [],

            'timeline' => TimelineStepResource::collection(
                $this->whenLoaded('timelineSteps')
            ),
            'escalations' => EscalationAttemptResource::collection(
                $this->whenLoaded('escalationAttempts')
            ),

            'metrics' => app(IncidentMetrics::class)->for($this->resource),

            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
