<?php

namespace App\Http\Controllers;

use App\Models\Incident;
use App\Models\SlaSetting;
use App\Services\SlaEvaluator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Единственная настраиваемая ручка SLA: сколько минут даётся на эскалацию
 * (обнаружение → передача ответственным), прежде чем инцидент считается
 * нарушившим SLA. Читать могут все авторизованные, менять — только инженеры.
 */
class SlaSettingController extends Controller
{
    public function __construct(private readonly SlaEvaluator $sla) {}

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->payload(SlaSetting::current())]);
    }

    /**
     * Меняет порог и тут же пересчитывает вердикт по SLA для всех
     * существующих инцидентов — иначе список продолжал бы показывать вердикт,
     * посчитанный по уже неактуальному порогу, до следующего чужого сохранения.
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'escalation_minutes' => ['required', 'integer', 'min:1', 'max:100000'],
        ]);

        $setting = SlaSetting::current();

        DB::transaction(function () use ($setting, $validated) {
            $setting->update($validated);

            Incident::query()
                ->select(['id', 'detected_at', 'started_at'])
                ->with('timelineSteps')
                ->get()
                ->each(function (Incident $incident) {
                    $incident->update(['sla' => $this->sla->for($incident)]);
                });
        });

        return response()->json(['data' => $this->payload($setting)]);
    }

    private function payload(SlaSetting $setting): array
    {
        return ['escalation_minutes' => $setting->escalation_minutes];
    }
}
