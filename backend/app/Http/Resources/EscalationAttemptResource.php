<?php

namespace App\Http\Resources;

use App\Enums\Concerns\LabeledEnum;
use App\Models\EscalationAttempt;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin EscalationAttempt */
class EscalationAttemptResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'position' => $this->position,
            'time' => $this->time,
            'callee_name' => $this->callee_name,
            'kind' => $this->enum($this->kind),
            'channel' => $this->enum($this->channel),
            'result' => $this->enum($this->result),
            'attempts' => $this->attempts,
        ];
    }

    /** @param  LabeledEnum&\BackedEnum  $enum */
    protected function enum($enum): array
    {
        return ['value' => $enum->value, 'label' => $enum->label()];
    }
}
