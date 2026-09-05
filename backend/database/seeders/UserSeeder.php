<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'engineer@ims.local'],
            [
                'name' => 'Иван Петров',
                'password' => 'password',
                'position' => 'Тех. поддержка',
                'role' => UserRole::Engineer,
                'email_verified_at' => now(),
            ],
        );

        User::updateOrCreate(
            ['email' => 'viewer@ims.local'],
            [
                'name' => 'Ольга Смирнова',
                'password' => 'password',
                'position' => 'Менеджер',
                'role' => UserRole::Viewer,
                'email_verified_at' => now(),
            ],
        );
    }
}
