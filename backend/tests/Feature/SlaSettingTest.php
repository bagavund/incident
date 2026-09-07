<?php

namespace Tests\Feature;

use App\Models\Incident;
use App\Models\SlaSetting;
use App\Models\User;
use App\Services\JwtService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SlaSettingTest extends TestCase
{
    use RefreshDatabase;

    public function test_show_returns_the_default_when_never_configured(): void
    {
        $this->actingAsOnDuty()
            ->getJson('/api/sla-setting')
            ->assertOk()
            ->assertJsonPath('data.escalation_minutes', SlaSetting::DEFAULT_ESCALATION_MINUTES);
    }

    public function test_on_duty_cannot_change_the_threshold(): void
    {
        $this->actingAsOnDuty()
            ->putJson('/api/sla-setting', ['escalation_minutes' => 15])
            ->assertForbidden();
    }

    public function test_admin_updates_the_threshold(): void
    {
        $this->actingAsAdmin()
            ->putJson('/api/sla-setting', ['escalation_minutes' => 15])
            ->assertOk()
            ->assertJsonPath('data.escalation_minutes', 15);

        $this->assertSame(15, SlaSetting::current()->escalation_minutes);
    }

    public function test_rejects_a_non_positive_threshold(): void
    {
        $this->actingAsAdmin()
            ->putJson('/api/sla-setting', ['escalation_minutes' => 0])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['escalation_minutes']);
    }

    public function test_changing_the_threshold_recomputes_sla_on_existing_incidents(): void
    {
        // withTimeline() ставит эскалацию через 35 минут после обнаружения.
        $incident = Incident::factory()->withTimeline()->create([
            'started_at' => '2026-06-01T10:00:00',
            'detected_at' => '2026-06-01T10:12:00',
        ]);

        $this->actingAsAdmin()
            ->putJson('/api/sla-setting', ['escalation_minutes' => 100])
            ->assertOk();
        $this->assertSame('met', $incident->fresh()->sla->value);

        $this->actingAsAdmin()
            ->putJson('/api/sla-setting', ['escalation_minutes' => 10])
            ->assertOk();
        $this->assertSame('breached', $incident->fresh()->sla->value);
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
