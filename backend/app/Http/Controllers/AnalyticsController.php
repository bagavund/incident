<?php

namespace App\Http\Controllers;

use App\Models\CustomFieldDefinition;
use App\Services\AnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AnalyticsController extends Controller
{
    public function __construct(private readonly AnalyticsService $analytics) {}

    public function dashboard(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'period' => ['nullable', 'integer', 'in:7,30,90,180,365'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $days = (int) ($validated['period'] ?? 30);

        return response()->json(
            $this->analytics->dashboard($days, $validated['from'] ?? null, $validated['to'] ?? null)
        );
    }

    public function customFieldChart(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'field' => ['required', 'string', Rule::exists('custom_field_definitions', 'key')],
            'period' => ['nullable', 'integer', 'in:7,30,90,180,365'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $field = CustomFieldDefinition::query()->where('key', $validated['field'])->firstOrFail();
        $days = (int) ($validated['period'] ?? 30);

        return response()->json(
            $this->analytics->customFieldChart($field, $days, $validated['from'] ?? null, $validated['to'] ?? null)
        );
    }
}
