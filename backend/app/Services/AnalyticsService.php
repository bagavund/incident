<?php

namespace App\Services;

use App\Enums\EscalationChannel;
use App\Enums\EscalationResult;
use App\Enums\IncidentSla;
use App\Enums\TimelineKind;
use App\Models\Incident;
use App\Models\IncidentType;
use App\Models\Zone;
use App\Support\Duration;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

class AnalyticsService
{
    private const HEATMAP_HOURS = [
        '00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11',
        '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23',
    ];

    private const HEATMAP_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    /**
     * Full payload for the dashboard screen. Mirrors what the frontend used to
     * compute client-side in src/data.ts — same formulas, same field names.
     */
    public function dashboard(int $days, ?string $from = null, ?string $to = null): array
    {
        $end = $to ? CarbonImmutable::parse($to) : CarbonImmutable::now();
        $start = $from ? CarbonImmutable::parse($from) : $end->subDays($days);
        $span = max(1, (int) round($start->diffInDays($end)));

        $prevEnd = $start;
        $prevStart = $start->subDays($span);

        $current = $this->incidentsBetween($start, $end);
        $previous = $this->incidentsBetween($prevStart, $prevEnd);

        // Рецидивы ищутся среди ВСЕХ инцидентов, а не только текущего окна — берём отдельно.
        $all = Incident::query()->with('services')->get(['id', 'cause', 'detected_at']);

        return [
            'period' => [
                'days' => $days,
                'from' => $start->toIso8601String(),
                'to' => $end->toIso8601String(),
            ],
            'kpis' => $this->kpis($current, $previous),
            'time_analytics' => $this->timeAnalytics($current, $previous),
            'by_day' => $this->byDay($current, $start, $end, $span),
            'by_zone' => $this->byZone($current),
            'by_type' => $this->byType($current),
            'top_services' => $this->topServices($current, $previous),
            'top_services_pie' => $this->topServicesPie($current),
            'heatmap' => $this->heatmap($current),
            'channel_speed' => $this->channelSpeed($current),
            'reliability' => [
                'prolonged_escalation_rate' => $this->prolongedEscalationRate($current),
                'recidivism_rate' => $this->recidivismRate($current, $all),
                'night_weekend_ratio' => $this->nightWeekendRatio($current),
                'first_call_success_rate' => $this->firstCallSuccessRate($current),
                'war_room_rate' => $this->warRoomRate($current),
            ],
        ];
    }

    /** @return Collection<int,Incident> */
    private function incidentsBetween(CarbonImmutable $start, CarbonImmutable $end): Collection
    {
        return Incident::query()
            ->with(['services', 'timelineSteps', 'escalationAttempts'])
            ->whereBetween('detected_at', [$start, $end])
            ->get();
    }

    /** @param  Collection<int,Incident>  $current */
    private function kpis(Collection $current, Collection $previous): array
    {
        $total = $current->count();
        $prevTotal = $previous->count();

        $resolution = $this->avgMinutes($current, fn (Incident $i) => Duration::minutesBetween($i->started_at, $i->resolved_at));
        $prevResolution = $this->avgMinutes($previous, fn (Incident $i) => Duration::minutesBetween($i->started_at, $i->resolved_at));

        $sla = $this->slaPercent($current);
        $prevSla = $this->slaPercent($previous);

        return [
            $this->metric('total', 'Всего инцидентов', (string) $total, $this->pct($total, $prevTotal), $total >= $prevTotal),
            $this->metric('resolution', 'Среднее время решения', Duration::human($resolution) ?? '—', $this->pct($resolution, $prevResolution), ($resolution ?? 0) >= ($prevResolution ?? 0)),
            $this->metric('sla', 'SLA соблюдено', $sla.'%', $sla - $prevSla, $sla >= $prevSla),
        ];
    }

    /** @param  Collection<int,Incident>  $current */
    private function timeAnalytics(Collection $current, Collection $previous): array
    {
        $detect = $this->avgMinutes($current, fn (Incident $i) => Duration::minutesBetween($i->started_at, $i->detected_at));
        $prevDetect = $this->avgMinutes($previous, fn (Incident $i) => Duration::minutesBetween($i->started_at, $i->detected_at));

        $diagnose = $this->avgMinutes($current, fn (Incident $i) => Duration::minutesBetween(
            $i->stepOfKind(TimelineKind::Diagnosis)?->occurred_at,
            $i->handedOffAt(),
        ));
        $prevDiagnose = $this->avgMinutes($previous, fn (Incident $i) => Duration::minutesBetween(
            $i->stepOfKind(TimelineKind::Diagnosis)?->occurred_at,
            $i->handedOffAt(),
        ));

        $escalate = $this->avgMinutes($current, fn (Incident $i) => Duration::minutesBetween(
            $i->detected_at,
            $i->handedOffAt(),
        ));
        $prevEscalate = $this->avgMinutes($previous, fn (Incident $i) => Duration::minutesBetween(
            $i->detected_at,
            $i->handedOffAt(),
        ));

        return [
            $this->metric(
                'to_detect', 'Среднее время до обнаружения', Duration::human($detect) ?? '—',
                $this->pct($detect, $prevDetect), ($detect ?? 0) >= ($prevDetect ?? 0),
                'Время между тем, когда началась проблема, и когда дежурный её обнаружил.',
            ),
            $this->metric(
                'to_diagnose', 'Среднее время на диагностику', Duration::human($diagnose) ?? '—',
                $this->pct($diagnose, $prevDiagnose), ($diagnose ?? 0) >= ($prevDiagnose ?? 0),
                'Время между началом диагностики и моментом, когда проблему передали ответственным.',
            ),
            $this->metric(
                'to_escalate', 'Среднее время до эскалации', Duration::human($escalate) ?? '—',
                $this->pct($escalate, $prevEscalate), ($escalate ?? 0) >= ($prevEscalate ?? 0),
                'Время между обнаружением и передачей проблемы ответственным.',
            ),
        ];
    }

    /** @param  Collection<int,Incident>  $current */
    private function byDay(Collection $current, CarbonImmutable $start, CarbonImmutable $end, int $span): array
    {
        $step = max(1, (int) ceil($span / 16));
        $byDate = $current->groupBy(fn (Incident $i) => $i->detected_at?->toDateString());

        $points = [];
        for ($cursor = $start; $cursor->lessThan($end); $cursor = $cursor->addDays($step)) {
            $bucketEnd = $cursor->addDays($step);
            $count = 0;
            for ($d = $cursor; $d->lessThan($bucketEnd); $d = $d->addDay()) {
                $count += $byDate->get($d->toDateString(), collect())->count();
            }
            $points[] = ['day' => $cursor->format('d.m'), 'date' => $cursor->toDateString(), 'count' => $count];
        }

        return $points;
    }

    /** Инциденты по зонам ответственности — включая зоны без единого инцидента. */
    /** @param  Collection<int,Incident>  $current */
    private function byZone(Collection $current): array
    {
        $counts = $current->flatMap(fn (Incident $i) => $i->zones ?? [])->countBy();

        return Zone::query()->orderBy('name')->pluck('name')
            ->map(fn (string $name) => ['name' => $name, 'value' => $counts->get($name, 0)])
            ->all();
    }

    /** @param  Collection<int,Incident>  $current */
    private function byType(Collection $current): array
    {
        $total = max(1, $current->count());
        $counts = $current->countBy(fn (Incident $i) => $i->type);

        return IncidentType::query()->orderBy('name')->pluck('name')
            ->map(fn (string $name) => [
                'name' => $name,
                'value' => $counts->get($name, 0),
                'pct' => (int) round($counts->get($name, 0) / $total * 100),
            ])
            ->all();
    }

    /** @param  Collection<int,Incident>  $current */
    private function heatmap(Collection $current): array
    {
        $matrix = array_fill(0, 7, array_fill(0, 24, 0));

        foreach ($current as $incident) {
            $at = $incident->detected_at;
            if (! $at) {
                continue;
            }
            $row = (int) $at->dayOfWeekIso - 1; // Пн = 0
            $col = (int) $at->hour;
            $matrix[$row][$col]++;
        }

        return [
            'hours' => self::HEATMAP_HOURS,
            'days' => self::HEATMAP_DAYS,
            'matrix' => $matrix,
        ];
    }

    /** Топ сервисов — один инцидент может затрагивать несколько сервисов, считаем каждый. */
    /** @param  Collection<int,Incident>  $current */
    private function topServices(Collection $current, Collection $previous): array
    {
        $prevCounts = $previous->flatMap(fn (Incident $i) => $i->services->pluck('name'))->countBy();

        return $current->flatMap(fn (Incident $i) => $i->services->pluck('name'))
            ->countBy()
            ->sortDesc()
            ->take(5)
            ->map(fn (int $count, string $name) => [
                'name' => $name,
                'count' => $count,
                'delta' => $this->pct($count, $prevCounts->get($name, 0)),
            ])
            ->values()
            ->all();
    }

    /** Топ-3 сервиса по числу инцидентов + бакет «Остальные» — для пай-чарта. */
    /** @param  Collection<int,Incident>  $current */
    private function topServicesPie(Collection $current): array
    {
        $named = $current->flatMap(fn (Incident $i) => $i->services->pluck('name'))->countBy()->sortDesc();

        $top3 = $named->take(3)->map(fn (int $value, string $name) => ['name' => $name, 'value' => $value])->values();
        $restTotal = $named->slice(3)->sum();

        return $restTotal > 0 ? [...$top3->all(), ['name' => 'Остальные', 'value' => $restTotal]] : $top3->all();
    }

    /** Для каждого канала связи — средняя длина серии попыток и доля успешных дозвонов. */
    /** @param  Collection<int,Incident>  $current */
    private function channelSpeed(Collection $current): array
    {
        $records = $current->flatMap(fn (Incident $i) => $i->escalationAttempts);

        return collect(EscalationChannel::cases())
            ->map(function (EscalationChannel $channel) use ($records) {
                $matching = $records->filter(fn ($e) => $e->channel === $channel);
                $total = $matching->count();
                $avgAttempts = $total ? round($matching->sum('attempts') / $total, 1) : 0;
                $success = $matching->filter(fn ($e) => $e->result === EscalationResult::Reached)->count();

                return [
                    'channel' => $channel->label(),
                    'avg_attempts' => $avgAttempts,
                    'success_rate' => $total ? (int) round($success / $total * 100) : 0,
                    'total' => $total,
                ];
            })
            ->filter(fn (array $c) => $c['total'] > 0)
            ->values()
            ->all();
    }

    /** % инцидентов, где хотя бы одна попытка эскалации не удалась (человек оказался недоступен). */
    /** @param  Collection<int,Incident>  $current */
    private function prolongedEscalationRate(Collection $current): int
    {
        if ($current->isEmpty()) {
            return 0;
        }

        $count = $current->filter(
            fn (Incident $i) => $i->escalationAttempts->contains(fn ($e) => $e->result === EscalationResult::NotReached)
        )->count();

        return (int) round($count / $current->count() * 100);
    }

    /**
     * % рецидивных инцидентов: инцидент считается рецидивом, если среди ВСЕХ инцидентов
     * (не только текущей выборки) за 90 дней до него был другой инцидент с той же причиной
     * и хотя бы одним общим сервисом.
     *
     * @param  Collection<int,Incident>  $current
     * @param  Collection<int,Incident>  $all
     */
    private function recidivismRate(Collection $current, Collection $all): int
    {
        if ($current->isEmpty()) {
            return 0;
        }

        $isRecidivist = function (Incident $inc) use ($all) {
            $cause = mb_strtolower(trim($inc->cause ?? ''));
            if ($cause === '' || ! $inc->detected_at) {
                return false;
            }
            $at = $inc->detected_at;
            $windowStart = $at->copy()->subDays(90);
            $mine = $inc->services->pluck('name');

            return $all->contains(function (Incident $other) use ($inc, $cause, $at, $windowStart, $mine) {
                if ($other->id === $inc->id || ! $other->detected_at) {
                    return false;
                }
                if ($other->detected_at->gte($at) || $other->detected_at->lt($windowStart)) {
                    return false;
                }
                if (mb_strtolower(trim($other->cause ?? '')) !== $cause) {
                    return false;
                }

                return $other->services->pluck('name')->intersect($mine)->isNotEmpty();
            });
        };

        return (int) round($current->filter($isRecidivist)->count() / $current->count() * 100);
    }

    /** % инцидентов, начавшихся ночью (21:00–09:00) или в выходные. */
    /** @param  Collection<int,Incident>  $current */
    private function nightWeekendRatio(Collection $current): int
    {
        if ($current->isEmpty()) {
            return 0;
        }

        $count = $current->filter(function (Incident $i) {
            $at = $i->started_at;
            if (! $at) {
                return false;
            }
            $isWeekend = (int) $at->dayOfWeek === 0 || (int) $at->dayOfWeek === 6;
            $isNight = (int) $at->hour >= 21 || (int) $at->hour < 9;

            return $isWeekend || $isNight;
        })->count();

        return (int) round($count / $current->count() * 100);
    }

    /** % попыток эскалации, когда дозвонились с первого раза. */
    /** @param  Collection<int,Incident>  $current */
    private function firstCallSuccessRate(Collection $current): int
    {
        $records = $current->flatMap(fn (Incident $i) => $i->escalationAttempts);
        if ($records->isEmpty()) {
            return 0;
        }

        $firstTry = $records->filter(fn ($e) => $e->attempts === 1 && $e->result === EscalationResult::Reached)->count();

        return (int) round($firstTry / $records->count() * 100);
    }

    /** % инцидентов, для которых собирали war room. */
    /** @param  Collection<int,Incident>  $current */
    private function warRoomRate(Collection $current): int
    {
        if ($current->isEmpty()) {
            return 0;
        }

        $count = $current->filter(
            fn (Incident $i) => $i->timelineSteps->contains(fn ($s) => $s->kind === TimelineKind::WarRoom)
        )->count();

        return (int) round($count / $current->count() * 100);
    }

    /** @param  Collection<int,Incident>  $items */
    private function avgMinutes(Collection $items, callable $resolver): ?int
    {
        $values = $items->map($resolver)->filter(fn ($v) => $v !== null && $v >= 0);

        return $values->isEmpty() ? null : (int) round($values->avg());
    }

    /** @param  Collection<int,Incident>  $items */
    private function slaPercent(Collection $items): int
    {
        if ($items->isEmpty()) {
            return 0;
        }

        $met = $items->where('sla', IncidentSla::Met)->count();

        return (int) round($met / $items->count() * 100);
    }

    private function pct(int|float|null $current, int|float|null $previous): int
    {
        $current ??= 0;
        $previous ??= 0;

        if ((float) $previous === 0.0) {
            return $current === 0 ? 0 : 100;
        }

        return (int) round(($current - $previous) / $previous * 100);
    }

    private function metric(string $key, string $label, string $value, int $delta, bool $up, ?string $hint = null): array
    {
        $metric = compact('key', 'label', 'value', 'delta', 'up');

        if ($hint !== null) {
            $metric['hint'] = $hint;
        }

        return $metric;
    }
}
