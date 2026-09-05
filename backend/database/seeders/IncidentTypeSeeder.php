<?php

namespace Database\Seeders;

use App\Models\IncidentType;
use Illuminate\Database\Seeder;

class IncidentTypeSeeder extends Seeder
{
    public const TYPES = [
        'Проблема на нашей стороне',
        'Внешняя проблема',
        'Сервис с проблемой',
        'Установлена заглушка',
    ];

    public function run(): void
    {
        foreach (self::TYPES as $name) {
            IncidentType::firstOrCreate(['name' => $name]);
        }
    }
}
