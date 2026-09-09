<?php

namespace Database\Factories;

use App\Enums\ProblemCategory;
use App\Models\Zone;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Zone> */
class ZoneFactory extends Factory
{
    protected $model = Zone::class;

    public function definition(): array
    {
        return [
            'name' => fake()->unique()->word(),
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
