<?php

namespace Database\Factories;

use App\Enums\CustomFieldType;
use App\Models\CustomFieldDefinition;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<CustomFieldDefinition> */
class CustomFieldDefinitionFactory extends Factory
{
    protected $model = CustomFieldDefinition::class;

    public function definition(): array
    {
        return [
            'key' => fake()->unique()->regexify('[a-z][a-z0-9_]{5,15}'),
            'label' => fake()->words(2, true),
            'type' => CustomFieldType::Text,
            'options' => null,
            'required' => false,
            'active' => true,
            'position' => 0,
        ];
    }
}
