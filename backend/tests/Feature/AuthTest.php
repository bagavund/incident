<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\JwtService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_a_token_and_user(): void
    {
        User::factory()->admin()->create([
            'username' => 'vkomlev',
            'password' => 'secret123',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'username' => 'vkomlev',
            'password' => 'secret123',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['token', 'token_type', 'expires_in', 'user' => ['id', 'role']])
            ->assertJsonPath('user.role', UserRole::Admin->value);
    }

    public function test_login_fails_with_wrong_password(): void
    {
        User::factory()->create(['username' => 'someone', 'password' => 'secret123']);

        $this->postJson('/api/auth/login', [
            'username' => 'someone',
            'password' => 'nope',
        ])->assertStatus(422);
    }

    public function test_protected_route_requires_a_token(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_me_returns_the_authenticated_user(): void
    {
        $user = User::factory()->create();

        $this->withToken($this->tokenFor($user))
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id);
    }

    public function test_logout_revokes_the_token(): void
    {
        $user = User::factory()->create();
        $token = $this->tokenFor($user);

        $this->withToken($token)->postJson('/api/auth/logout')->assertOk();
        $this->withToken($token)->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_refresh_issues_a_new_token_and_invalidates_the_old_one(): void
    {
        $user = User::factory()->create();
        $old = $this->tokenFor($user);

        $new = $this->withToken($old)->postJson('/api/auth/refresh')
            ->assertOk()
            ->json('token');

        $this->assertNotSame($old, $new);
        $this->withToken($old)->getJson('/api/auth/me')->assertUnauthorized();
        $this->withToken($new)->getJson('/api/auth/me')->assertOk();
    }

    private function tokenFor(User $user): string
    {
        return app(JwtService::class)->issue($user)['token'];
    }
}
