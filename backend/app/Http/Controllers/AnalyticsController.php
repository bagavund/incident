<?php

namespace App\Http\Controllers;

use App\Services\AnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
}
