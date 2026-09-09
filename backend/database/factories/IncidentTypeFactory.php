<?php

namespace Database\Factories;

use App\Enums\ProblemCategory;
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
            'category' => ProblemCategory::Internal,
        ];
    }

    public function external(): static
    {
        return $this->state(['category' => ProblemCategory::External]);
    }

    public function internal(): static
    {
        return $this->state(['category' => ProblemCategory::Internal]);
    }
}
