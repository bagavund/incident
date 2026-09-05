<?php

namespace App\Http\Controllers;

use App\Http\Requests\TimelineStepRequest;
use App\Http\Resources\TimelineStepResource;
use App\Models\Incident;
use App\Models\TimelineStep;
use Illuminate\Http\Response;

class TimelineStepController extends Controller
{
    public function store(TimelineStepRequest $request, Incident $incident): TimelineStepResource
    {
        $position = $request->input('position')
            ?? (int) $incident->timelineSteps()->max('position') + 1;

        $step = $incident->timelineSteps()->create([
            'position' => $position,
            'kind' => $request->input('kind'),
            'action' => $request->input('action'),
            'time' => $request->input('time'),
            'custom' => (bool) $request->input('custom', false),
        ]);

        return new TimelineStepResource($step);
    }

    public function update(TimelineStepRequest $request, Incident $incident, TimelineStep $step): TimelineStepResource
    {
        abort_unless($step->incident_id === $incident->id, 404);

        $step->fill($request->safe()->only(['position', 'kind', 'action', 'time', 'custom']));
        $step->save();

        return new TimelineStepResource($step);
    }

    public function destroy(Incident $incident, TimelineStep $step): Response
    {
        abort_unless($step->incident_id === $incident->id, 404);

        $step->delete();

        return response()->noContent();
    }
}
