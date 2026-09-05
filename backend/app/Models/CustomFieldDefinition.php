<?php

namespace App\Models;

use App\Enums\CustomFieldType;
use Database\Factories\CustomFieldDefinitionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['key', 'label', 'type', 'options', 'required', 'active', 'position'])]
class CustomFieldDefinition extends Model
{
    /** @use HasFactory<CustomFieldDefinitionFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'type' => CustomFieldType::class,
            'options' => 'array',
            'required' => 'boolean',
            'active' => 'boolean',
        ];
    }

    /** Value-правила для валидации значения этого поля в custom_fields несущей сущности. */
    public function valueRules(): array
    {
        $rules = $this->type->valueRules();

        if ($this->type === CustomFieldType::Select) {
            $rules[] = 'in:'.implode(',', $this->options ?? []);
        }

        return $this->required ? ['required', ...$rules] : ['nullable', ...$rules];
    }

    /** Есть ли хотя бы один инцидент, где это поле заполнено. */
    public function hasValues(): bool
    {
        return Incident::query()
            ->whereNotNull('custom_fields')
            ->whereJsonContainsKey('custom_fields->'.$this->key)
            ->exists();
    }
}
