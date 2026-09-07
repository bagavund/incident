<?php

namespace App\Models;

use App\Enums\IncidentSla;
use App\Enums\IncidentStatus;
use App\Enums\TimelineKind;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'code', 'title', 'created_by', 'type', 'criticality', 'status', 'sla',
    'on_duty_user_id', 'started_at', 'detected_at', 'resolved_at',
    'stub_installed', 'stub_on', 'stub_off',
    'cause', 'impact', 'task_link', 'zones',
])]
class Incident extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'status' => IncidentStatus::class,
            'sla' => IncidentSla::class,
            'started_at' => 'datetime',
            'detected_at' => 'datetime',
            'resolved_at' => 'datetime',
            'stub_installed' => 'boolean',
            'zones' => 'array',
        ];
    }

    /** Route model binding resolves by the human-readable code (INC-2026-00001), not the numeric id. */
    public function getRouteKeyName(): string
    {
        return 'code';
    }

    /** @return BelongsToMany<Service, $this> */
    public function services(): BelongsToMany
    {
        return $this->belongsToMany(Service::class);
    }

    /** @return BelongsTo<User, $this> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Дежурный, вписанный в этот инцидент — единственный, кроме админа, кто вправе его редактировать. */
    public function onDuty(): BelongsTo
    {
        return $this->belongsTo(User::class, 'on_duty_user_id');
    }

    /** @return HasMany<TimelineStep, $this> */
    public function timelineSteps(): HasMany
    {
        return $this->hasMany(TimelineStep::class)->orderBy('position');
    }

    /** @return HasMany<EscalationAttempt, $this> */
    public function escalationAttempts(): HasMany
    {
        return $this->hasMany(EscalationAttempt::class)->orderBy('position');
    }

    /** @return HasMany<IncidentAudit, $this> */
    public function audits(): HasMany
    {
        return $this->hasMany(IncidentAudit::class)->latest('created_at');
    }

    public function stepOfKind(TimelineKind $kind): ?TimelineStep
    {
        return $this->timelineSteps->firstWhere('kind', $kind);
    }

    /**
     * Момент передачи ответственным — timestamp шага "handed_off", уже
     * привязанный к дате начала инцидента при сохранении (TimelineSync).
     * Null, пока эскалации не было или шаг не заполнен.
     */
    public function handedOffAt(): ?CarbonInterface
    {
        return $this->stepOfKind(TimelineKind::HandedOff)?->occurred_at;
    }

    /**
     * Generate the next incident code: INC-{year}-{00001}.
     */
    public static function nextCode(?int $year = null): string
    {
        $year ??= (int) now()->year;
        $prefix = "INC-{$year}-";

        $last = static::query()
            ->where('code', 'like', $prefix.'%')
            ->orderByDesc('code')
            ->value('code');

        $seq = $last ? ((int) substr($last, strlen($prefix)) + 1) : 1;

        return $prefix.str_pad((string) $seq, 5, '0', STR_PAD_LEFT);
    }

    /** @param  Builder<Incident>  $query */
    public function scopeFilter(Builder $query, array $filters): Builder
    {
        return $query
            ->when($filters['search'] ?? null, fn (Builder $q, string $term) => $q->where(
                fn (Builder $w) => $w
                    ->where('code', 'like', "%{$term}%")
                    ->orWhere('title', 'like', "%{$term}%")
                    ->orWhereHas('services', fn (Builder $s) => $s->where('name', 'like', "%{$term}%"))
            ))
            ->when($filters['status'] ?? null, fn (Builder $q, $v) => $q->where('status', $v))
            ->when($filters['type'] ?? null, fn (Builder $q, $v) => $q->where('type', $v))
            ->when($filters['sla'] ?? null, fn (Builder $q, $v) => $q->where('sla', $v))
            ->when($filters['criticality'] ?? null, fn (Builder $q, $v) => $q->where('criticality', $v))
            ->when($filters['zone'] ?? null, fn (Builder $q, $v) => $q->whereJsonContains('zones', $v))
            ->when($filters['service'] ?? null, function (Builder $q, $v) {
                is_numeric($v)
                    ? $q->whereHas('services', fn (Builder $s) => $s->where('services.id', $v))
                    : $q->whereHas('services', fn (Builder $s) => $s->where('name', $v));
            })
            ->when($filters['from'] ?? null, fn (Builder $q, $v) => $q->where('detected_at', '>=', $v))
            ->when($filters['to'] ?? null, fn (Builder $q, $v) => $q->where('detected_at', '<=', $v));
    }
}
