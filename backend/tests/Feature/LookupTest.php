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
    public function test_admin_adds_a_value(string $prefix, string $model): void
    {
        $this->actingAsAdmin()
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

        $this->actingAsAdmin()
            ->postJson("/api/{$prefix}", ['name' => 'api gateway'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    #[DataProvider('dictionaries')]
    public function test_on_duty_cannot_write(string $prefix, string $model): void
    {
        $this->actingAsOnDuty()
            ->postJson("/api/{$prefix}", ['name' => 'x'])
            ->assertForbidden();
    }

    #[DataProvider('dictionaries')]
    public function test_rename_rejects_collision_with_another_row(string $prefix, string $model): void
    {
        $model::create(['name' => 'Значение А']);
        $b = $model::create(['name' => 'Значение Б']);

        $this->actingAsAdmin()
            ->putJson("/api/{$prefix}/{$b->id}", ['name' => 'значение а'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    public function test_delete_is_blocked_while_a_service_is_in_use(): void
    {
        $service = Service::factory()->create();
        Incident::factory()->create()->services()->attach($service);

        $this->actingAsAdmin()
            ->deleteJson("/api/services/{$service->id}")
            ->assertStatus(409);

        $this->assertDatabaseHas('services', ['id' => $service->id]);
    }

    public function test_delete_is_blocked_while_a_zone_is_in_use(): void
    {
        $zone = Zone::factory()->create(['name' => 'Backend']);
        Incident::factory()->create(['zones' => ['Backend']]);

        $this->actingAsAdmin()
            ->deleteJson("/api/zones/{$zone->id}")
            ->assertStatus(409);
    }

    public function test_delete_is_blocked_while_an_incident_type_is_in_use(): void
    {
        $type = IncidentType::factory()->create();
        Incident::factory()->create(['type' => $type->name]);

        $this->actingAsAdmin()
            ->deleteJson("/api/incident-types/{$type->id}")
            ->assertStatus(409);
    }

    public function test_renaming_a_zone_cascades_into_incidents(): void
    {
        $zone = Zone::factory()->create(['name' => 'Backend']);
        $incident = Incident::factory()->create(['zones' => ['Backend', 'DBA']]);

        $this->actingAsAdmin()
            ->putJson("/api/zones/{$zone->id}", ['name' => 'Бэкенд'])
            ->assertOk()
            ->assertJsonPath('data.usage_count', 1);

        $this->assertSame(['Бэкенд', 'DBA'], $incident->fresh()->zones);
    }

    public function test_renaming_an_incident_type_cascades_into_incidents(): void
    {
        $type = IncidentType::factory()->create(['name' => 'Внешняя']);
        $incident = Incident::factory()->create(['type' => 'Внешняя']);

        $this->actingAsAdmin()
            ->putJson("/api/incident-types/{$type->id}", ['name' => 'Внешний сбой'])
            ->assertOk()
            ->assertJsonPath('data.usage_count', 1);

        $this->assertSame('Внешний сбой', $incident->fresh()->type);
    }

    /** @return array<string,array{0:string}> */
    public static function categorizedDictionaries(): array
    {
        return ['incident-types' => ['incident-types'], 'zones' => ['zones']];
    }

    #[DataProvider('categorizedDictionaries')]
    public function test_dictionary_row_carries_a_category(string $prefix): void
    {
        $this->actingAsAdmin()
            ->postJson("/api/{$prefix}", ['name' => 'КРОК', 'category' => 'external'])
            ->assertCreated()
            ->assertJsonPath('data.category', 'external');

        // Без категории — «на нашей стороне» по умолчанию.
        $this->actingAsAdmin()
            ->postJson("/api/{$prefix}", ['name' => 'WEB01'])
            ->assertCreated()
            ->assertJsonPath('data.category', 'internal');
    }

    #[DataProvider('categorizedDictionaries')]
    public function test_dictionary_category_is_validated(string $prefix): void
    {
        $this->actingAsAdmin()
            ->postJson("/api/{$prefix}", ['name' => 'Значение', 'category' => 'bogus'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['category']);
    }

    public function test_renaming_a_criticality_cascades_into_incidents(): void
    {
        $criticality = Criticality::factory()->create(['name' => 'Важный']);
        $incident = Incident::factory()->create(['criticality' => 'Важный']);

        $this->actingAsAdmin()
            ->putJson("/api/criticalities/{$criticality->id}", ['name' => 'Высокий'])
            ->assertOk();

        $this->assertSame('Высокий', $incident->fresh()->criticality);
    }

    public function test_unused_value_can_be_deleted(): void
    {
        $zone = Zone::factory()->create();

        $this->actingAsAdmin()
            ->deleteJson("/api/zones/{$zone->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('zones', ['id' => $zone->id]);
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
