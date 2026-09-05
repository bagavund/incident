<?php

namespace Database\Factories;

use App\Models\Criticality;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Criticality> */
class CriticalityFactory extends Factory
{
    protected $model = Criticality::class;

    public function definition(): array
    {
        return [
            'name' => fake()->unique()->word(),
        ];
    }
}
