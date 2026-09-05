<?php

namespace Database\Factories;

use App\Models\IncidentType;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<IncidentType> */
class IncidentTypeFactory extends Factory
{
    protected $model = IncidentType::class;

    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(2, true),
        ];
    }
}
