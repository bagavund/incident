<?php

namespace Database\Seeders;

use App\Models\Criticality;
use Illuminate\Database\Seeder;

class CriticalitySeeder extends Seeder
{
    public const CRITICALITIES = ['Критичный', 'Важный', 'Второстепенный'];

    public function run(): void
    {
        foreach (self::CRITICALITIES as $name) {
            Criticality::firstOrCreate(['name' => $name]);
        }
    }
}
