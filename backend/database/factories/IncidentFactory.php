<?php

namespace Database\Factories;

use App\Enums\IncidentSla;
use App\Enums\IncidentStatus;
use App\Enums\TimelineKind;
use App\Models\Criticality;
use App\Models\Incident;
use App\Models\IncidentType;
use App\Models\Service;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Incident> */
class IncidentFactory extends Factory
{
    protected $model = Incident::class;

    public function definition(): array
    {
        $detected = fake()->dateTimeBetween('-40 days', 'now');
        $started = (clone $detected)->modify('-12 minutes');

        return [
            'code' => strtoupper(fake()->unique()->bothify('INC-2026-#####')),
            'title' => fake()->sentence(4),
            'type' => IncidentType::query()->inRandomOrder()->value('name')
                ?? IncidentType::factory()->create()->name,
            'criticality' => Criticality::query()->inRandomOrder()->value('name')
                ?? Criticality::factory()->create()->name,
            'status' => IncidentStatus::Published,
            'sla' => fake()->randomElement(IncidentSla::cases()),
            'on_duty_user_id' => User::query()->inRandomOrder()->value('id')
                ?? User::factory()->onDuty()->create()->id,
            'started_at' => $started,
            'detected_at' => $detected,
            'resolved_at' => (clone $detected)->modify('+3 hours'),
            'cause' => fake()->sentence(),
            'impact' => fake()->sentence(),
            'impact_targets' => fake()->randomElement([['site'], ['app'], ['site', 'app'], []]),
            'zones' => ['Backend'],
        ];
    }

    public function configure(): static
    {
        return $this->afterCreating(function (Incident $incident) {
            if ($incident->services()->count() === 0) {
                $incident->services()->attach(Service::factory()->create());
            }
        });
    }

    public function withTimeline(): static
    {
        return $this->afterCreating(function (Incident $incident) {
            $base = $incident->detected_at;
            $steps = [
                [TimelineKind::Detected, $base],
                [TimelineKind::Diagnosis, $base->copy()->addMinutes(5)],
                [TimelineKind::HandedOff, $base->copy()->addMinutes(35)],
                [TimelineKind::Resolved, $base->copy()->addHours(3)],
            ];

            foreach ($steps as $i => [$kind, $at]) {
                $incident->timelineSteps()->create([
                    'position' => $i,
                    'kind' => $kind,
                    'action' => $kind->label(),
                    'occurred_at' => $at,
                ]);
            }
        });
    }
}
