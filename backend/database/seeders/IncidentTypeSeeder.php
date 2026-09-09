<?php

namespace Database\Seeders;

use App\Enums\ProblemCategory;
use App\Models\IncidentType;
use Illuminate\Database\Seeder;

class IncidentTypeSeeder extends Seeder
{
    /** Тип инцидента = категория проблемы: значение и его категория совпадают. */
    public const TYPES = [
        ProblemCategory::External,
        ProblemCategory::Internal,
    ];

    public function run(): void
    {
        foreach (self::TYPES as $category) {
            IncidentType::firstOrCreate(['name' => $category->label()], ['category' => $category->value]);
        }
    }
}
