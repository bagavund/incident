<?php

namespace App\Http\Controllers;

use App\Enums\IncidentStatus;
use App\Http\Requests\IncidentRequest;
use App\Http\Resources\IncidentAuditResource;
use App\Http\Resources\IncidentDetailResource;
use App\Models\Incident;
use App\Services\IncidentMetrics;
use App\Services\SlaEvaluator;
use App\Support\EscalationSync;
use App\Support\IncidentAuditor;
use App\Support\TimelineSync;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class IncidentController extends Controller
{
    public function __construct(private readonly SlaEvaluator $sla) {}

    /**
     * Frontend keeps its own client-side analytics over the full incident set,
     * so this returns full detail (not the lightweight row shape) and allows a
     * large page size to fetch everything in one call.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $perPage = min(2000, max(5, (int) $request->input('per_page', 15)));

        $incidents = Incident::query()
            ->with(['services', 'onDuty', 'timelineSteps', 'escalationAttempts'])
            ->filter($request->only([
                'search', 'status', 'type', 'sla', 'criticality', 'zone', 'service', 'from', 'to',
            ]))
            ->orderByDesc('detected_at')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();

        return IncidentDetailResource::collection($incidents);
    }

    public function store(IncidentRequest $request): JsonResponse
    {
        $data = $request->validated();

        $incident = DB::transaction(function () use ($data, $request) {
            $incident = new Incident([
                ...collect($data)->except(['timeline', 'escalations', 'services'])->all(),
                'code' => Incident::nextCode(),
                'created_by' => $request->user()->id,
                'stub_installed' => $data['stub_installed'] ?? false,
            ]);

            $incident->save();

            $incident->services()->sync($data['services'] ?? []);

            TimelineSync::apply(
                $incident,
                $data['timeline'] ?? TimelineSync::defaultSteps(),
            );

            EscalationSync::apply($incident, $data['escalations'] ?? []);

            // SLA — от времени до эскалации, которое живёт в timeline_steps,
            // поэтому считать его можно только после TimelineSync::apply().
            $incident->update(['sla' => $this->sla->for($incident)]);

            IncidentAuditor::created($incident, $request->user());

            return $incident;
        });

        return $this->show($incident->fresh())
            ->response()
            ->setStatusCode(201);
    }

    public function show(Incident $incident): IncidentDetailResource
    {
        $incident->load(['services', 'author', 'onDuty', 'timelineSteps', 'escalationAttempts']);

        return new IncidentDetailResource($incident);
    }

    public function update(IncidentRequest $request, Incident $incident): IncidentDetailResource
    {
        $data = $request->validated();

        DB::transaction(function () use ($incident, $data, $request) {
            $before = $incident->getAttributes();
            $beforeServiceIds = $incident->services()->pluck('services.id')->all();

            $incident->fill(collect($data)->except(['timeline', 'escalations', 'services'])->all());
            $incident->save();

            if (array_key_exists('services', $data)) {
                $incident->services()->sync($data['services']);
            }

            if (array_key_exists('timeline', $data)) {
                TimelineSync::apply($incident, $data['timeline'] ?? []);
            }

            if (array_key_exists('escalations', $data)) {
                EscalationSync::apply($incident, $data['escalations'] ?? []);
            }

            // SLA — от времени до эскалации, которое живёт в timeline_steps,
            // поэтому пересчитывать его нужно после TimelineSync::apply().
            $incident->update(['sla' => $this->sla->for($incident)]);

            IncidentAuditor::updated(
                $incident,
                $request->user(),
                $before,
                $beforeServiceIds,
                $incident->services()->pluck('services.id')->all(),
            );
        });

        return $this->show($incident->fresh());
    }

    public function audit(Incident $incident): AnonymousResourceCollection
    {
        return IncidentAuditResource::collection($incident->audits()->with('user')->get());
    }

    /** Печатный отчёт доступен только для опубликованных инцидентов — черновик ещё не прошёл постмортем. */
    public function pdf(Incident $incident): SymfonyResponse
    {
        abort_unless($incident->status === IncidentStatus::Published, 404);

        $incident->load(['services', 'onDuty', 'timelineSteps', 'escalationAttempts']);

        return Pdf::loadView('incidents.report', [
            'incident' => $incident,
            'metrics' => app(IncidentMetrics::class)->for($incident),
            'generatedAt' => now()->format('d.m.Y H:i'),
            'fmt' => fn ($dt) => $dt?->format('d.m.Y H:i') ?? '—',
        ])->download("{$incident->code}.pdf");
    }

    public function destroy(Request $request, Incident $incident): Response
    {
        abort_unless($request->user()->can('delete', $incident), 403, 'Недостаточно прав для этого действия.');

        IncidentAuditor::deleted($incident, $request->user());
        $incident->delete();

        return response()->noContent();
    }
}
