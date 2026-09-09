<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use RuntimeException;

class UserSeeder extends Seeder
{
    /**
     * Единственная учётка на свежем развёртывании — администратор; остальных заводит он сам.
     * Пароль берётся из ADMIN_PASSWORD. На проде переменная обязательна; вне прода,
     * если её нет, генерируется случайный пароль и печатается в вывод сидера.
     */
    public function run(): void
    {
        $password = (string) env('ADMIN_PASSWORD', '');

        if ($password === '') {
            if (app()->environment('production')) {
                throw new RuntimeException('ADMIN_PASSWORD must be set to seed the admin account in production.');
            }

            $password = Str::password(16);
            $this->command?->warn("ADMIN_PASSWORD не задан — сгенерирован пароль администратора: {$password}");
        }

        User::updateOrCreate(
            ['username' => 'admin'],
            [
                'name' => 'Администратор',
                'password' => $password,
                'position' => 'Руководитель поддержки',
                'role' => UserRole::Admin,
            ],
        );
    }
}
