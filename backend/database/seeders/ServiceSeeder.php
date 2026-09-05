<?php

namespace Database\Seeders;

use App\Models\Service;
use Illuminate\Database\Seeder;

class ServiceSeeder extends Seeder
{
    public const SERVICES = [
        'API Gateway',
        'Мобильное приложение',
        'Авторизация',
        'Платёжный сервис',
        'Личный кабинет',
        'Уведомления',
        'Данные',
    ];

    public function run(): void
    {
        foreach (self::SERVICES as $name) {
            Service::firstOrCreate(['name' => $name]);
        }
    }
}
