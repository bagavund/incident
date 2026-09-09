<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Свежее развёртывание поднимается чистым: администратор, справочники типов
     * и критичностей, настройка SLA. Каталог сервисов и зон, пользователи-дежурные
     * и сами инциденты заводятся уже в работающей системе (или импортом).
     */
    public function run(): void
    {
        $this->call([
            IncidentTypeSeeder::class,
            CriticalitySeeder::class,
            UserSeeder::class,
        ]);
    }
}
