<?php

namespace Tests\Feature;

use App\Models\Incident;
use App\Models\User;
use App\Models\Zone;
use App\Services\JwtService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AnalyticsTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_returns_the_full_payload(): void
    {
        Zone::factory()->create(['name' => 'Backend']);

        Incident::factory()->count(6)->withTimeline()->create([
            'zones' => ['Backend'],
            'detected_at' => now()->subDays(5),
            'started_at' => now()->subDays(5)->subMinutes(10),
            'resolved_at' => now()->subDays(5)->addHours(2),
        ]);

        $user = User::factory()->create();

        $this->withToken(app(JwtService::class)->issue($user)['token'])
            ->getJson('/api/analytics/dashboard?period=30')
            ->assertOk()
            ->assertJsonStructure([
                'period' => ['days', 'from', 'to'],
                'kpis' => [['key', 'label', 'value', 'delta', 'up']],
                'time_analytics' => [['key', 'label', 'value', 'hint']],
                'by_day' => [['day', 'date', 'count']],
                'by_zone' => [['name', 'value']],
                'by_type' => [['name', 'value', 'pct']],
                'top_services' => [['name', 'count', 'delta']],
                'top_services_pie',
                'heatmap' => ['hours', 'days', 'matrix'],
                'channel_speed',
                'reliability' => [
                    'prolonged_escalation_rate', 'recidivism_rate', 'night_weekend_ratio',
                    'first_call_success_rate', 'war_room_rate',
                ],
            ])
            ->assertJsonPath('kpis.0.value', '6')
            ->assertJsonPath('by_zone.0.name', 'Backend')
            ->assertJsonPath('by_zone.0.value', 6)
            ->assertJsonCount(7, 'heatmap.matrix')
            ->assertJsonCount(24, 'heatmap.matrix.0');
    }

    public function test_dashboard_rejects_an_unknown_period(): void
    {
        $user = User::factory()->create();

        $this->withToken(app(JwtService::class)->issue($user)['token'])
            ->getJson('/api/analytics/dashboard?period=42')
            ->assertStatus(422);
    }

    public function test_reliability_metrics_reflect_escalations_and_timeline(): void
    {
        $incident = Incident::factory()->create([
            'cause' => 'Утечка памяти',
            'detected_at' => now()->subDay(),
            'started_at' => now()->subDay()->subMinutes(10),
        ]);
        $incident->escalationAttempts()->create([
            'position' => 0, 'time' => '10:00', 'callee_name' => 'Иванов',
            'kind' => 'responsible', 'channel' => 'phone', 'result' => 'not_reached', 'attempts' => 2,
        ]);
        $incident->timelineSteps()->create([
            'position' => 0, 'kind' => 'war_room', 'action' => 'Собран war room', 'time' => '10:05',
        ]);

        $user = User::factory()->create();

        $response = $this->withToken(app(JwtService::class)->issue($user)['token'])
            ->getJson('/api/analytics/dashboard?period=30')
            ->assertOk();

        $response->assertJsonPath('reliability.prolonged_escalation_rate', 100);
        $response->assertJsonPath('reliability.war_room_rate', 100);
        $response->assertJsonPath('reliability.first_call_success_rate', 0);
    }
}
