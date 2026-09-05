<?php

namespace Tests\Feature;

use App\Models\Criticality;
use App\Models\Incident;
use App\Models\IncidentType;
use App\Models\Service;
use App\Models\User;
use App\Models\Zone;
use App\Services\JwtService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IncidentTest extends TestCase
{
    use RefreshDatabase;

    public function test_listing_is_paginated_and_filterable(): void
    {
        Incident::factory()->count(3)->create();
        $needle = Incident::factory()->create(['title' => 'Полный отвал платежей']);

        $this->actingAsViewer()
            ->getJson('/api/incidents?search=отвал')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $needle->id)
            ->assertJsonStructure(['data', 'links', 'meta']);
    }

    public function test_viewer_cannot_create_an_incident(): void
    {
        [$service, $type, $criticality] = $this->baseline();

        $this->actingAsViewer()
            ->postJson('/api/incidents', [
                'title' => 'x', 'services' => [$service->id], 'type' => $type->name,
                'criticality' => $criticality->name, 'on_duty_name' => 'Иванов Иван',
                'started_at' => '2026-06-01T10:00:00',
            ])
            ->assertForbidden();
    }

    public function test_engineer_creates_an_incident_with_timeline(): void
    {
        [$service, $type, $criticality] = $this->baseline();
        Zone::factory()->create(['name' => 'Backend']);
        Zone::factory()->create(['name' => 'База данных']);

        $response = $this->actingAsEngineer()->postJson('/api/incidents', [
            'title' => 'Ошибки 500 в оплате',
            'services' => [$service->id],
            'type' => $type->name,
            'criticality' => $criticality->name,
            'on_duty_name' => 'Иванов Иван',
            'status' => 'published',
            'started_at' => '2026-06-01T10:00:00',
            'detected_at' => '2026-06-01T10:12:00',
            'resolved_at' => '2026-06-01T12:40:00',
            'zones' => ['Backend', 'База данных'],
            'timeline' => [
                ['kind' => 'detected', 'action' => 'Алерт', 'time' => '10:12'],
                ['kind' => 'diagnosis', 'action' => 'Логи', 'time' => '10:20'],
                ['kind' => 'handed_off', 'action' => 'Эскалация', 'time' => '10:50'],
                ['kind' => 'resolved', 'action' => 'Фикс', 'time' => '12:40'],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.code', fn ($code) => str_starts_with($code, 'INC-'))
            ->assertJsonCount(1, 'data.services')
            ->assertJsonCount(4, 'data.timeline')
            ->assertJsonPath('data.timeline.0.time', '10:12')
            ->assertJsonPath('data.metrics.to_detect.minutes', 12)
            ->assertJsonPath('data.metrics.to_diagnose.minutes', 30);

        $this->assertDatabaseCount('timeline_steps', 4);
    }

    public function test_engineer_creates_an_incident_with_multiple_services_and_escalations(): void
    {
        $services = Service::factory()->count(2)->create();
        [, $type, $criticality] = $this->baseline();

        $response = $this->actingAsEngineer()->postJson('/api/incidents', [
            'title' => 'Массовый сбой',
            'services' => $services->pluck('id')->all(),
            'type' => $type->name,
            'criticality' => $criticality->name,
            'on_duty_name' => 'Иванов Иван',
            'started_at' => '2026-06-01T10:00:00',
            'escalations' => [
                ['time' => '10:05', 'callee_name' => 'Петров Пётр', 'kind' => 'responsible', 'channel' => 'phone', 'result' => 'not_reached', 'attempts' => 2],
                ['time' => '10:10', 'callee_name' => 'Петров Пётр', 'kind' => 'responsible', 'channel' => 'telegram', 'result' => 'reached', 'attempts' => 1],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonCount(2, 'data.services')
            ->assertJsonCount(2, 'data.escalations')
            ->assertJsonPath('data.escalations.0.result.value', 'not_reached');

        $this->assertDatabaseCount('escalation_attempts', 2);
    }

    public function test_show_returns_metrics_and_timeline(): void
    {
        $incident = Incident::factory()->withTimeline()->create();

        $this->actingAsViewer()
            ->getJson("/api/incidents/{$incident->code}")
            ->assertOk()
            ->assertJsonPath('data.id', $incident->id)
            ->assertJsonStructure([
                'data' => ['metrics' => ['to_detect', 'to_diagnose', 'to_resolve'], 'timeline', 'escalations', 'zones'],
            ]);
    }

    public function test_engineer_updates_and_deletes(): void
    {
        $incident = Incident::factory()->withTimeline()->create();

        $this->actingAsEngineer()
            ->patchJson("/api/incidents/{$incident->code}", ['title' => 'Новое название'])
            ->assertOk()
            ->assertJsonPath('data.title', 'Новое название');

        $this->actingAsEngineer()
            ->deleteJson("/api/incidents/{$incident->code}")
            ->assertNoContent();

        $this->assertDatabaseMissing('incidents', ['id' => $incident->id]);
        $this->assertDatabaseCount('timeline_steps', 0);
    }

    public function test_validation_errors_are_returned_as_422(): void
    {
        $this->actingAsEngineer()
            ->postJson('/api/incidents', ['title' => '', 'type' => 'bogus'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title', 'services', 'type', 'criticality', 'on_duty_name', 'started_at']);
    }

    /** @return array{0:Service,1:IncidentType,2:Criticality} */
    private function baseline(): array
    {
        return [Service::factory()->create(), IncidentType::factory()->create(), Criticality::factory()->create()];
    }

    private function actingAsEngineer(): static
    {
        return $this->withToken($this->tokenFor(User::factory()->engineer()->create()));
    }

    private function actingAsViewer(): static
    {
        return $this->withToken($this->tokenFor(User::factory()->viewer()->create()));
    }

    private function tokenFor(User $user): string
    {
        return app(JwtService::class)->issue($user)['token'];
    }
}
