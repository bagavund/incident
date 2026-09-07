<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /** Username => [name, position] — дежурные, на которых ссылается IncidentSeeder. */
    public const ON_DUTY = [
        'ivanov' => ['Иванов Иван', 'Тех. поддержка'],
        'petrova' => ['Петрова Анна', 'Тех. поддержка'],
        'sidorov' => ['Сидоров Пётр', 'Тех. поддержка'],
        'kuznecova' => ['Кузнецова Мария', 'Тех. поддержка'],
    ];

    public function run(): void
    {
        User::updateOrCreate(
            ['username' => 'admin'],
            [
                'name' => 'Администратор',
                'password' => 'password',
                'position' => 'Руководитель поддержки',
                'role' => UserRole::Admin,
            ],
        );

        foreach (self::ON_DUTY as $username => [$name, $position]) {
            User::updateOrCreate(
                ['username' => $username],
                [
                    'name' => $name,
                    'password' => 'password',
                    'position' => $position,
                    'role' => UserRole::OnDuty,
                ],
            );
        }
    }
}
