<?php

namespace App\Http\Resources;

use App\Models\CustomFieldDefinition;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin CustomFieldDefinition */
class CustomFieldDefinitionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'key' => $this->key,
            'label' => $this->label,
            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'options' => $this->options ?? [],
            'required' => $this->required,
            'active' => $this->active,
            'position' => $this->position,
        ];
    }
}
