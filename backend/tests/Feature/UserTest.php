<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\JwtService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Учётки заводит только администратор — самостоятельной регистрации нет.
 */
class UserTest extends TestCase
{
    use RefreshDatabase;

    public function test_any_authenticated_user_can_list_users(): void
    {
        User::factory()->onDuty()->create(['name' => 'Иванов Иван']);

        $this->actingAsOnDuty()
            ->getJson('/api/users')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Иванов Иван']);
    }

    public function test_on_duty_cannot_create_a_user(): void
    {
        $this->actingAsOnDuty()
            ->postJson('/api/users', [
                'name' => 'Новый Дежурный',
                'username' => 'new_duty',
                'password' => 'password123',
                'password_confirmation' => 'password123',
                'role' => 'on_duty',
            ])
            ->assertForbidden();
    }

    public function test_admin_creates_a_user(): void
    {
        $response = $this->actingAsAdmin()
            ->postJson('/api/users', [
                'name' => 'Комлев Владислав',
                'username' => 'vkomlev',
                'password' => 'password123',
                'password_confirmation' => 'password123',
                'role' => 'on_duty',
            ]);

        $response->assertCreated()
            ->assertJsonPath('data.username', 'vkomlev')
            ->assertJsonPath('data.role', UserRole::OnDuty->value)
            ->assertJsonMissingPath('data.password');

        $this->assertDatabaseHas('users', ['username' => 'vkomlev', 'name' => 'Комлев Владислав']);
    }

    public function test_username_must_be_unique(): void
    {
        User::factory()->create(['username' => 'vkomlev']);

        $this->actingAsAdmin()
            ->postJson('/api/users', [
                'name' => 'Дубликат',
                'username' => 'vkomlev',
                'password' => 'password123',
                'password_confirmation' => 'password123',
                'role' => 'on_duty',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['username']);
    }

    private function actingAsAdmin(): static
    {
        return $this->withToken($this->tokenFor(User::factory()->admin()->create()));
    }

    private function actingAsOnDuty(): static
    {
        return $this->withToken($this->tokenFor(User::factory()->onDuty()->create()));
    }

    private function tokenFor(User $user): string
    {
        return app(JwtService::class)->issue($user)['token'];
    }
}
