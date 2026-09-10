<?php

namespace Tests\Feature;

use App\Enums\TimelineKind;
use App\Models\Criticality;
use App\Models\Incident;
use App\Models\IncidentType;
use App\Models\Service;
use App\Models\SlaSetting;
use App\Models\User;
use App\Models\Zone;
use App\Services\JwtService;
use App\Services\SlaEvaluator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class IncidentTest extends TestCase
{
    use RefreshDatabase;

    public function test_listing_is_paginated_and_filterable(): void
    {
        Incident::factory()->count(3)->create();
        $needle = Incident::factory()->create(['title' => 'Полный отвал платежей']);

        $this->actingAsOnDuty()
            ->getJson('/api/incidents?search=отвал')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $needle->id)
            ->assertJsonStructure(['data', 'links', 'meta']);
    }

    public function test_on_duty_creates_an_incident_with_timeline(): void
    {
        [$service, $type, $criticality] = $this->baseline();
        $onDuty = User::factory()->onDuty()->create();
        Zone::factory()->create(['name' => 'Backend']);
        Zone::factory()->create(['name' => 'База данных']);

        $response = $this->actingAsOnDuty()->postJson('/api/incidents', [
            'title' => 'Ошибки 500 в оплате',
            'services' => [$service->id],
            'type' => $type->name,
            'criticality' => $criticality->name,
            'on_duty_user_id' => $onDuty->id,
            'status' => 'published',
            'started_at' => '2026-06-01T10:00:00',
            'detected_at' => '2026-06-01T10:12:00',
            'resolved_at' => '2026-06-01T12:40:00',
            'zones' => ['Backend', 'База данных'],
            'impact' => 'Оплата не проходила у части пользователей',
            'impact_targets' => ['site', 'app'],
            'timeline' => [
                ['kind' => 'detected', 'action' => 'Алерт', 'time' => '10:12'],
                ['kind' => 'diagnosis', 'action' => 'Логи', 'time' => '10:20'],
                ['kind' => 'handed_off', 'action' => 'Эскалация', 'time' => '10:50'],
                ['kind' => 'resolved', 'action' => 'Фикс', 'time' => '12:40'],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.code', fn ($code) => str_starts_with($code, 'INC-'))
            ->assertJsonPath('data.on_duty.id', $onDuty->id)
            ->assertJsonCount(1, 'data.services')
            ->assertJsonCount(4, 'data.timeline')
            ->assertJsonPath('data.timeline.0.time', '10:12')
            ->assertJsonPath('data.metrics.to_detect.minutes', 12)
            ->assertJsonPath('data.metrics.to_escalate.minutes', 38)
            ->assertJsonPath('data.metrics.to_diagnose.minutes', 30);

        $this->assertDatabaseCount('timeline_steps', 4);
    }

    public function test_admin_creates_an_incident_with_multiple_services_and_escalations(): void
    {
        $services = Service::factory()->count(2)->create();
        [, $type, $criticality] = $this->baseline();
        $onDuty = User::factory()->onDuty()->create();

        $response = $this->actingAsAdmin()->postJson('/api/incidents', [
            'title' => 'Массовый сбой',
            'services' => $services->pluck('id')->all(),
            'type' => $type->name,
            'criticality' => $criticality->name,
            'on_duty_user_id' => $onDuty->id,
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

        $this->actingAsOnDuty()
            ->getJson("/api/incidents/{$incident->code}")
            ->assertOk()
            ->assertJsonPath('data.id', $incident->id)
            ->assertJsonStructure([
                'data' => ['metrics' => ['to_detect', 'to_escalate', 'to_diagnose', 'to_resolve'], 'timeline', 'escalations', 'zones'],
            ]);
    }

    public function test_admin_updates_and_deletes_any_incident(): void
    {
        $incident = Incident::factory()->withTimeline()->create();

        $this->actingAsAdmin()
            ->patchJson("/api/incidents/{$incident->code}", ['title' => 'Новое название'])
            ->assertOk()
            ->assertJsonPath('data.title', 'Новое название');

        $this->actingAsAdmin()
            ->deleteJson("/api/incidents/{$incident->code}")
            ->assertNoContent();

        $this->assertDatabaseMissing('incidents', ['id' => $incident->id]);
        $this->assertDatabaseCount('timeline_steps', 0);
    }

    public function test_on_duty_user_updates_and_deletes_their_own_incident(): void
    {
        $onDuty = User::factory()->onDuty()->create();
        $incident = Incident::factory()->withTimeline()->create(['on_duty_user_id' => $onDuty->id]);

        $this->withToken($this->tokenFor($onDuty))
            ->patchJson("/api/incidents/{$incident->code}", ['title' => 'Новое название'])
            ->assertOk()
            ->assertJsonPath('data.title', 'Новое название');

        $this->withToken($this->tokenFor($onDuty))
            ->deleteJson("/api/incidents/{$incident->code}")
            ->assertNoContent();

        $this->assertDatabaseMissing('incidents', ['id' => $incident->id]);
    }

    public function test_on_duty_user_cannot_edit_an_incident_assigned_to_someone_else(): void
    {
        $assigned = User::factory()->onDuty()->create();
        $someoneElse = User::factory()->onDuty()->create();
        $incident = Incident::factory()->create(['on_duty_user_id' => $assigned->id]);

        $this->withToken($this->tokenFor($someoneElse))
            ->patchJson("/api/incidents/{$incident->code}", ['title' => 'Чужой инцидент'])
            ->assertForbidden();

        $this->withToken($this->tokenFor($someoneElse))
            ->deleteJson("/api/incidents/{$incident->code}")
            ->assertForbidden();

        $this->assertDatabaseHas('incidents', ['id' => $incident->id]);
    }

    public function test_validation_errors_are_returned_as_422(): void
    {
        // Черновик требует только название; переданное неверное значение всё равно проверяется.
        $this->actingAsAdmin()
            ->postJson('/api/incidents', ['title' => '', 'type' => 'bogus'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title', 'type'])
            ->assertJsonMissingValidationErrors(['services', 'criticality', 'on_duty_user_id', 'started_at']);
    }

    public function test_a_draft_needs_only_a_title(): void
    {
        $this->actingAsAdmin()
            ->postJson('/api/incidents', ['title' => 'Черновик без деталей'])
            ->assertCreated();
    }

    public function test_publishing_requires_the_base_fields_too(): void
    {
        $this->actingAsAdmin()
            ->postJson('/api/incidents', ['title' => 'Публикация вслепую', 'status' => 'published'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['services', 'type', 'criticality', 'on_duty_user_id', 'started_at']);
    }

    public function test_publishing_requires_the_postmortem_fields(): void
    {
        [$service, $type, $criticality] = $this->baseline();
        $onDuty = User::factory()->onDuty()->create();

        $this->actingAsAdmin()->postJson('/api/incidents', [
            'title' => 'Сбой без постмортема',
            'services' => [$service->id],
            'type' => $type->name,
            'criticality' => $criticality->name,
            'on_duty_user_id' => $onDuty->id,
            'status' => 'published',
            'started_at' => '2026-06-01T10:00:00',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['resolved_at', 'zones', 'impact', 'impact_targets']);
    }

    public function test_a_draft_is_saved_without_the_postmortem_fields(): void
    {
        [$service, $type, $criticality] = $this->baseline();
        $onDuty = User::factory()->onDuty()->create();

        $this->actingAsAdmin()->postJson('/api/incidents', [
            'title' => 'Черновик',
            'services' => [$service->id],
            'type' => $type->name,
            'criticality' => $criticality->name,
            'on_duty_user_id' => $onDuty->id,
            'status' => 'draft',
            'started_at' => '2026-06-01T10:00:00',
        ])->assertCreated();
    }

    public function test_impact_targets_round_trip_including_the_no_impact_marker(): void
    {
        [$service, $type, $criticality] = $this->baseline();
        $onDuty = User::factory()->onDuty()->create();
        Zone::factory()->create(['name' => 'Backend']);

        $publish = fn (array $override) => $this->actingAsAdmin()->postJson('/api/incidents', [
            'title' => 'Сбой',
            'services' => [$service->id],
            'type' => $type->name,
            'criticality' => $criticality->name,
            'on_duty_user_id' => $onDuty->id,
            'status' => 'published',
            'started_at' => '2026-06-01T10:00:00',
            'resolved_at' => '2026-06-01T11:00:00',
            'zones' => ['Backend'],
            'impact' => 'Описание влияния',
            ...$override,
        ]);

        $publish(['impact_targets' => ['site', 'app']])
            ->assertCreated()
            ->assertJsonPath('data.impact_targets', ['site', 'app']);

        $publish(['impact_targets' => []])
            ->assertCreated()
            ->assertJsonPath('data.impact_targets', []);

        $publish(['impact_targets' => ['carrier_pigeon']])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['impact_targets.0']);
    }

    public function test_sla_is_computed_server_side_from_the_escalation_threshold(): void
    {
        SlaSetting::current()->update(['escalation_minutes' => 30]);
        [$service, $type, $criticality] = $this->baseline();
        $onDuty = User::factory()->onDuty()->create();

        $payload = [
            'title' => 'Долгий сбой',
            'services' => [$service->id],
            'type' => $type->name,
            'criticality' => $criticality->name,
            'on_duty_user_id' => $onDuty->id,
            'started_at' => '2026-06-01T10:00:00',
            'detected_at' => '2026-06-01T10:12:00',
            'timeline' => [
                ['kind' => 'detected', 'time' => '10:12'],
                ['kind' => 'handed_off', 'time' => '10:50'], // 38 минут от обнаружения — дольше 30-минутного порога
            ],
            // Клиент настаивает на «Соблюден» — сервер обязан его переспорить.
            'sla' => 'met',
        ];

        $this->actingAsAdmin()->postJson('/api/incidents', $payload)
            ->assertCreated()
            ->assertJsonPath('data.sla.value', 'breached');
    }

    public function test_sla_is_recomputed_when_the_handoff_time_changes(): void
    {
        SlaSetting::current()->update(['escalation_minutes' => 30]);
        $incident = Incident::factory()->withTimeline()->create([
            'started_at' => '2026-06-01T10:00:00',
            'detected_at' => '2026-06-01T10:12:00',
        ]);
        $handedOff = $incident->stepOfKind(TimelineKind::HandedOff);

        // Двигаем эскалацию вплотную к обнаружению — вписывается в порог.
        $this->actingAsAdmin()
            ->patchJson("/api/incidents/{$incident->code}", [
                'timeline' => [['id' => $handedOff->id, 'kind' => 'handed_off', 'time' => '10:15']],
            ])
            ->assertOk()
            ->assertJsonPath('data.sla.value', 'met');
    }

    public function test_an_incident_without_an_escalation_yet_has_not_breached_sla(): void
    {
        SlaSetting::current()->update(['escalation_minutes' => 5]);
        $incident = Incident::factory()->create([
            'started_at' => now()->subDay(),
            'detected_at' => now()->subDay(),
            'sla' => 'breached',
        ]);

        $this->actingAsAdmin()
            ->patchJson("/api/incidents/{$incident->code}", ['title' => 'Ещё чиним'])
            ->assertOk()
            ->assertJsonPath('data.sla.value', 'met');
    }

    public function test_creating_an_incident_writes_a_created_audit_entry(): void
    {
        [$service, $type, $criticality] = $this->baseline();
        $admin = User::factory()->admin()->create();
        $onDuty = User::factory()->onDuty()->create();

        $this->withToken($this->tokenFor($admin))->postJson('/api/incidents', [
            'title' => 'Сбой оплаты',
            'services' => [$service->id],
            'type' => $type->name,
            'criticality' => $criticality->name,
            'on_duty_user_id' => $onDuty->id,
            'started_at' => '2026-06-01T10:00:00',
        ])->assertCreated();

        $incident = Incident::sole();

        $this->actingAsOnDuty()
            ->getJson("/api/incidents/{$incident->code}/audit")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.action', 'created')
            ->assertJsonPath('data.0.user.id', $admin->id);
    }

    public function test_updating_an_incident_records_only_the_changed_fields(): void
    {
        $incident = Incident::factory()->create(['title' => 'Старое название']);

        $this->actingAsAdmin()
            ->patchJson("/api/incidents/{$incident->code}", ['title' => 'Новое название'])
            ->assertOk();

        $entries = $this->actingAsOnDuty()
            ->getJson("/api/incidents/{$incident->code}/audit")
            ->assertOk()
            ->assertJsonPath('data.0.action', 'updated')
            ->json('data');

        $this->assertSame(['Старое название', 'Новое название'], $entries[0]['changes']['title']);
        $this->assertArrayNotHasKey('on_duty_user_id', $entries[0]['changes']);
    }

    public function test_resending_unchanged_json_fields_does_not_record_a_phantom_change(): void
    {
        [$service, $type, $criticality] = $this->baseline();
        Zone::factory()->create(['name' => 'Backend']);

        $code = $this->actingAsAdmin()->postJson('/api/incidents', [
            'title' => 'Инцидент с площадками',
            'services' => [$service->id],
            'type' => $type->name,
            'criticality' => $criticality->name,
            'on_duty_user_id' => User::factory()->onDuty()->create()->id,
            'started_at' => '2026-06-01T10:00:00',
            'zones' => ['Backend'],
            'impact_targets' => ['site', 'app'],
        ])->assertCreated()->json('data.code');

        // Форма всегда шлёт полный payload — те же массивы приходят обратно без изменений.
        $this->actingAsAdmin()
            ->patchJson("/api/incidents/{$code}", [
                'title' => 'Инцидент с площадками — правка',
                'zones' => ['Backend'],
                'impact_targets' => ['site', 'app'],
            ])
            ->assertOk();

        $entries = $this->actingAsAdmin()
            ->getJson("/api/incidents/{$code}/audit")
            ->json('data');

        $changes = collect($entries)->firstWhere('action', 'updated')['changes'];

        $this->assertSame(['Инцидент с площадками', 'Инцидент с площадками — правка'], $changes['title']);
        $this->assertArrayNotHasKey('impact_targets', $changes);
        $this->assertArrayNotHasKey('zones', $changes);
    }

    public function test_updating_services_records_the_id_diff(): void
    {
        $incident = Incident::factory()->create();
        $beforeIds = $incident->services()->pluck('services.id')->sort()->values()->all();
        $newService = Service::factory()->create();

        $this->actingAsAdmin()
            ->patchJson("/api/incidents/{$incident->code}", ['services' => [$newService->id]])
            ->assertOk();

        $entries = $this->actingAsOnDuty()
            ->getJson("/api/incidents/{$incident->code}/audit")
            ->json('data');

        $this->assertSame([$beforeIds, [$newService->id]], $entries[0]['changes']['services']);
    }

    public function test_a_no_op_save_does_not_add_an_audit_entry(): void
    {
        $incident = Incident::factory()->create(['title' => 'Без изменений']);
        // Фабрика проставляет sla как попало; синхронизируем его с тем, что
        // выдаст SlaEvaluator, иначе первый же PATCH «исправит» это значение
        // и это будет настоящее изменение, а не ложный шум в тесте.
        $incident->update(['sla' => app(SlaEvaluator::class)->for($incident)]);

        $this->actingAsAdmin()
            ->patchJson("/api/incidents/{$incident->code}", ['title' => 'Без изменений'])
            ->assertOk();

        // Инцидент создан фабрикой напрямую, в обход контроллера — записи о
        // создании нет; и раз ничего не поменялось, записи об обновлении тоже нет.
        $this->assertDatabaseCount('incident_audits', 0);
    }

    public function test_the_cleanup_migration_prunes_phantom_diffs_from_old_audit_rows(): void
    {
        $incident = Incident::factory()->create();

        $realOnly = DB::table('incident_audits')->insertGetId([
            'incident_id' => $incident->id,
            'incident_code' => $incident->code,
            'incident_title' => $incident->title,
            'action' => 'updated',
            'changes' => json_encode(['sla' => ['breached', 'met']]),
            'created_at' => now(),
        ]);
        $mixed = DB::table('incident_audits')->insertGetId([
            'incident_id' => $incident->id,
            'incident_code' => $incident->code,
            'incident_title' => $incident->title,
            'action' => 'updated',
            'changes' => json_encode([
                'title' => ['Старое', 'Новое'],
                'impact_targets' => ['["site", "app"]', '["site","app"]'],
                'stub_installed' => [0, false],
            ]),
            'created_at' => now(),
        ]);
        $phantomOnly = DB::table('incident_audits')->insertGetId([
            'incident_id' => $incident->id,
            'incident_code' => $incident->code,
            'incident_title' => $incident->title,
            'action' => 'updated',
            'changes' => json_encode(['zones' => ['["A"]', '["A"]']]),
            'created_at' => now(),
        ]);

        (require database_path('migrations/2026_09_10_000001_prune_phantom_json_diffs_from_incident_audits.php'))->up();

        $this->assertSame(
            ['sla' => ['breached', 'met']],
            json_decode(DB::table('incident_audits')->where('id', $realOnly)->value('changes'), true),
        );
        $this->assertSame(
            ['title' => ['Старое', 'Новое']],
            json_decode(DB::table('incident_audits')->where('id', $mixed)->value('changes'), true),
        );
        $this->assertDatabaseMissing('incident_audits', ['id' => $phantomOnly]);
    }

    public function test_deleting_an_incident_writes_a_deleted_audit_entry_that_outlives_the_row(): void
    {
        $incident = Incident::factory()->create(['title' => 'Уходящий инцидент']);
        $code = $incident->code;

        $this->actingAsAdmin()
            ->deleteJson("/api/incidents/{$code}")
            ->assertNoContent();

        $this->assertDatabaseHas('incident_audits', [
            'incident_id' => null,
            'incident_code' => $code,
            'incident_title' => 'Уходящий инцидент',
            'action' => 'deleted',
        ]);
    }

    public function test_a_step_time_that_wraps_past_midnight_is_stored_on_the_next_day(): void
    {
        [$service, $type, $criticality] = $this->baseline();
        $onDuty = User::factory()->onDuty()->create();

        $response = $this->actingAsAdmin()->postJson('/api/incidents', [
            'title' => 'Ночной сбой',
            'services' => [$service->id],
            'type' => $type->name,
            'criticality' => $criticality->name,
            'on_duty_user_id' => $onDuty->id,
            'started_at' => '2026-06-01T23:40:00',
            'detected_at' => '2026-06-01T23:45:00',
            'resolved_at' => '2026-06-02T01:10:00',
            'timeline' => [
                ['kind' => 'detected', 'time' => '23:45'],
                ['kind' => 'handed_off', 'time' => '00:20'],
                ['kind' => 'resolved', 'time' => '01:10'],
            ],
        ])->assertCreated();

        // 00:20 и 01:10 ушли назад относительно 23:45 — сервер перенёс их на 2 июня.
        $response->assertJsonPath('data.timeline.1.occurred_at', fn ($v) => str_starts_with($v, '2026-06-02T00:20'))
            ->assertJsonPath('data.timeline.2.occurred_at', fn ($v) => str_starts_with($v, '2026-06-02T01:10'))
            ->assertJsonPath('data.metrics.to_escalate.minutes', 35)
            ->assertJsonPath('data.metrics.to_resolve.minutes', 90);
    }

    public function test_show_reports_stub_duration_and_escalation_spans_from_the_server(): void
    {
        [$service, $type, $criticality] = $this->baseline();
        $onDuty = User::factory()->onDuty()->create();

        $code = $this->actingAsAdmin()->postJson('/api/incidents', [
            'title' => 'Сбой с заглушкой',
            'services' => [$service->id],
            'type' => $type->name,
            'criticality' => $criticality->name,
            'on_duty_user_id' => $onDuty->id,
            'started_at' => '2026-06-01T10:00:00',
            'detected_at' => '2026-06-01T10:05:00',
            'stub_installed' => true,
            'stub_on' => '10:15',
            'stub_off' => '10:45',
            'timeline' => [
                ['kind' => 'detected', 'time' => '10:05'],
                ['kind' => 'handed_off', 'time' => '10:30'],
            ],
            'escalations' => [
                ['time' => '10:06', 'kind' => 'responsible', 'channel' => 'phone', 'result' => 'not_reached', 'attempts' => 2],
                ['time' => '10:20', 'kind' => 'responsible', 'channel' => 'phone', 'result' => 'reached', 'attempts' => 1],
            ],
        ])->assertCreated()->json('data.code');

        $this->actingAsOnDuty()
            ->getJson("/api/incidents/{$code}")
            ->assertOk()
            ->assertJsonPath('data.metrics.stub_duration.minutes', 30)
            ->assertJsonPath('data.metrics.escalation.total_calls', 3)
            ->assertJsonPath('data.metrics.escalation.responsible_span.minutes', 14)
            ->assertJsonPath('data.metrics.escalation.approval_span.minutes', null);
    }

    /** @return array{0:Service,1:IncidentType,2:Criticality} */
    private function baseline(): array
    {
        return [Service::factory()->create(), IncidentType::factory()->create(), Criticality::factory()->create()];
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
