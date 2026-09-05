<?php

namespace App\Http\Controllers;

use App\Http\Requests\IncidentRequest;
use App\Http\Resources\IncidentDetailResource;
use App\Models\Incident;
use App\Support\EscalationSync;
use App\Support\TimelineSync;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class IncidentController extends Controller
{
    /**
     * Frontend keeps its own client-side analytics over the full incident set,
     * so this returns full detail (not the lightweight row shape) and allows a
     * large page size to fetch everything in one call.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $perPage = min(2000, max(5, (int) $request->input('per_page', 15)));

        $incidents = Incident::query()
            ->with(['services', 'timelineSteps', 'escalationAttempts'])
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
            $incident = Incident::create([
                ...collect($data)->except(['timeline', 'escalations', 'services'])->all(),
                'code' => Incident::nextCode(),
                'created_by' => $request->user()->id,
                'stub_installed' => $data['stub_installed'] ?? false,
            ]);

            $incident->services()->sync($data['services']);

            TimelineSync::apply(
                $incident,
                $data['timeline'] ?? TimelineSync::defaultSteps(),
            );

            EscalationSync::apply($incident, $data['escalations'] ?? []);

            return $incident;
        });

        return $this->show($incident->fresh())
            ->response()
            ->setStatusCode(201);
    }

    public function show(Incident $incident): IncidentDetailResource
    {
        $incident->load(['services', 'author', 'timelineSteps', 'escalationAttempts']);

        return new IncidentDetailResource($incident);
    }

    public function update(IncidentRequest $request, Incident $incident): IncidentDetailResource
    {
        $data = $request->validated();

        DB::transaction(function () use ($incident, $data) {
            $incident->fill(collect($data)->except(['timeline', 'escalations', 'services'])->all())->save();

            if (array_key_exists('services', $data)) {
                $incident->services()->sync($data['services']);
            }

            if (array_key_exists('timeline', $data)) {
                TimelineSync::apply($incident, $data['timeline'] ?? []);
            }

            if (array_key_exists('escalations', $data)) {
                EscalationSync::apply($incident, $data['escalations'] ?? []);
            }
        });

        return $this->show($incident->fresh());
    }

    public function destroy(Incident $incident): Response
    {
        $incident->delete();

        return response()->noContent();
    }
}
