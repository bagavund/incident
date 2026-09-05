<?php

namespace Database\Seeders;

use App\Models\Zone;
use Illuminate\Database\Seeder;

class ZoneSeeder extends Seeder
{
    public const ZONES = [
        'Backend',
        'Frontend',
        'Инфраструктура / DevOps',
        'Внешний провайдер',
        'База данных',
    ];

    public function run(): void
    {
        foreach (self::ZONES as $name) {
            Zone::firstOrCreate(['name' => $name]);
        }
    }
}
