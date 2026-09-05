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
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Shared CRUD behaviour for the admin-editable dictionaries, mirrored across
 * services / zones / incident-types / criticalities via LookupController.
 */
class LookupTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string,array{0:string,1:class-string}> */
    public static function dictionaries(): array
    {
        return [
            'services' => ['services', Service::class],
            'zones' => ['zones', Zone::class],
            'incident-types' => ['incident-types', IncidentType::class],
            'criticalities' => ['criticalities', Criticality::class],
        ];
    }

    #[DataProvider('dictionaries')]
    public function test_engineer_adds_a_value(string $prefix, string $model): void
    {
        $this->actingAsEngineer()
            ->postJson("/api/{$prefix}", ['name' => 'Новое значение'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Новое значение')
            ->assertJsonPath('data.usage_count', 0);

        $this->assertDatabaseHas((new $model)->getTable(), ['name' => 'Новое значение']);
    }

    #[DataProvider('dictionaries')]
    public function test_duplicate_name_is_rejected_case_insensitively(string $prefix, string $model): void
    {
        $model::create(['name' => 'API Gateway']);

        $this->actingAsEngineer()
            ->postJson("/api/{$prefix}", ['name' => 'api gateway'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    #[DataProvider('dictionaries')]
    public function test_viewer_cannot_write(string $prefix, string $model): void
    {
        $this->actingAsViewer()
            ->postJson("/api/{$prefix}", ['name' => 'x'])
            ->assertForbidden();
    }

    #[DataProvider('dictionaries')]
    public function test_rename_rejects_collision_with_another_row(string $prefix, string $model): void
    {
        $model::create(['name' => 'Значение А']);
        $b = $model::create(['name' => 'Значение Б']);

        $this->actingAsEngineer()
            ->putJson("/api/{$prefix}/{$b->id}", ['name' => 'значение а'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    public function test_delete_is_blocked_while_a_service_is_in_use(): void
    {
        $service = Service::factory()->create();
        Incident::factory()->create()->services()->attach($service);

        $this->actingAsEngineer()
            ->deleteJson("/api/services/{$service->id}")
            ->assertStatus(409);

        $this->assertDatabaseHas('services', ['id' => $service->id]);
    }

    public function test_delete_is_blocked_while_a_zone_is_in_use(): void
    {
        $zone = Zone::factory()->create(['name' => 'Backend']);
        Incident::factory()->create(['zones' => ['Backend']]);

        $this->actingAsEngineer()
            ->deleteJson("/api/zones/{$zone->id}")
            ->assertStatus(409);
    }

    public function test_delete_is_blocked_while_an_incident_type_is_in_use(): void
    {
        $type = IncidentType::factory()->create();
        Incident::factory()->create(['type' => $type->name]);

        $this->actingAsEngineer()
            ->deleteJson("/api/incident-types/{$type->id}")
            ->assertStatus(409);
    }

    public function test_unused_value_can_be_deleted(): void
    {
        $zone = Zone::factory()->create();

        $this->actingAsEngineer()
            ->deleteJson("/api/zones/{$zone->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('zones', ['id' => $zone->id]);
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
