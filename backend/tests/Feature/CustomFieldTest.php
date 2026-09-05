<?php

namespace Tests\Feature;

use App\Models\Criticality;
use App\Models\CustomFieldDefinition;
use App\Models\Incident;
use App\Models\IncidentType;
use App\Models\Service;
use App\Models\User;
use App\Services\JwtService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomFieldTest extends TestCase
{
    use RefreshDatabase;

    public function test_engineer_creates_a_select_field_definition(): void
    {
        $this->actingAsEngineer()
            ->postJson('/api/custom-field-definitions', [
                'key' => 'root_cause_team',
                'label' => 'Команда первопричины',
                'type' => 'select',
                'options' => ['Backend', 'Frontend', 'Infra'],
                'required' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.key', 'root_cause_team')
            ->assertJsonPath('data.type', 'select');

        $this->assertDatabaseHas('custom_field_definitions', ['key' => 'root_cause_team']);
    }

    public function test_select_field_requires_options(): void
    {
        $this->actingAsEngineer()
            ->postJson('/api/custom-field-definitions', [
                'key' => 'no_options',
                'label' => 'Без опций',
                'type' => 'select',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['options']);
    }

    public function test_viewer_cannot_manage_field_definitions(): void
    {
        $this->actingAsViewer()
            ->postJson('/api/custom-field-definitions', [
                'key' => 'x', 'label' => 'x', 'type' => 'text',
            ])
            ->assertForbidden();
    }

    public function test_incident_accepts_valid_custom_field_values(): void
    {
        CustomFieldDefinition::factory()->create([
            'key' => 'root_cause_team',
            'type' => 'select',
            'options' => ['Backend', 'Frontend'],
            'required' => true,
        ]);
        [$service, $type, $criticality] = $this->baseline();

        $this->actingAsEngineer()
            ->postJson('/api/incidents', [
                'title' => 'Инцидент с кастомным полем',
                'services' => [$service->id],
                'type' => $type->name,
                'criticality' => $criticality->name,
                'on_duty_name' => 'Иванов Иван',
                'started_at' => '2026-06-01T10:00:00',
                'custom_fields' => ['root_cause_team' => 'Backend'],
            ])
            ->assertCreated()
            ->assertJsonPath('data.custom_fields.root_cause_team', 'Backend');
    }

    public function test_incident_rejects_invalid_custom_field_value(): void
    {
        CustomFieldDefinition::factory()->create([
            'key' => 'root_cause_team',
            'type' => 'select',
            'options' => ['Backend', 'Frontend'],
            'required' => true,
        ]);
        [$service, $type, $criticality] = $this->baseline();

        $this->actingAsEngineer()
            ->postJson('/api/incidents', [
                'title' => 'Инцидент с кастомным полем',
                'services' => [$service->id],
                'type' => $type->name,
                'criticality' => $criticality->name,
                'on_duty_name' => 'Иванов Иван',
                'started_at' => '2026-06-01T10:00:00',
                'custom_fields' => ['root_cause_team' => 'НеСуществующая'],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['custom_fields.root_cause_team']);
    }

    public function test_deleting_field_with_data_archives_it_instead(): void
    {
        $field = CustomFieldDefinition::factory()->create(['key' => 'root_cause_team', 'type' => 'text', 'required' => false]);
        Incident::factory()->create(['custom_fields' => ['root_cause_team' => 'x']]);

        $this->actingAsEngineer()
            ->deleteJson("/api/custom-field-definitions/{$field->id}")
            ->assertNoContent();

        $this->assertDatabaseHas('custom_field_definitions', ['id' => $field->id, 'active' => false]);
    }

    public function test_custom_field_chart_returns_grouped_counts(): void
    {
        $field = CustomFieldDefinition::factory()->create([
            'key' => 'root_cause_team', 'type' => 'select', 'options' => ['Backend', 'Frontend'],
        ]);
        Incident::factory()->count(2)->create(['custom_fields' => ['root_cause_team' => 'Backend'], 'detected_at' => now()]);
        Incident::factory()->create(['custom_fields' => ['root_cause_team' => 'Frontend'], 'detected_at' => now()]);

        $this->actingAsViewer()
            ->getJson('/api/analytics/custom-field-chart?field=root_cause_team&period=30')
            ->assertOk()
            ->assertJsonPath('field.key', 'root_cause_team')
            ->assertJsonFragment(['name' => 'Backend', 'value' => 2])
            ->assertJsonFragment(['name' => 'Frontend', 'value' => 1]);
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
