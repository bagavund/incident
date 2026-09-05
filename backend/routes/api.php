<?php

use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CriticalityController;
use App\Http\Controllers\CustomFieldDefinitionController;
use App\Http\Controllers\IncidentController;
use App\Http\Controllers\IncidentTypeController;
use App\Http\Controllers\MetaController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\TimelineStepController;
use App\Http\Controllers\ZoneController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public
|--------------------------------------------------------------------------
*/
Route::post('auth/register', [AuthController::class, 'register']);
Route::post('auth/login', [AuthController::class, 'login']);

/*
|--------------------------------------------------------------------------
| Authenticated (JWT)
|--------------------------------------------------------------------------
*/
Route::middleware('auth.jwt')->group(function () {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::post('auth/refresh', [AuthController::class, 'refresh']);

    Route::get('meta', [MetaController::class, 'index']);
    Route::get('analytics/dashboard', [AnalyticsController::class, 'dashboard']);
    Route::get('analytics/custom-field-chart', [AnalyticsController::class, 'customFieldChart']);

    Route::get('custom-field-definitions', [CustomFieldDefinitionController::class, 'index']);

    // Admin-editable dictionaries — read for everyone
    Route::get('services', [ServiceController::class, 'index']);
    Route::get('zones', [ZoneController::class, 'index']);
    Route::get('incident-types', [IncidentTypeController::class, 'index']);
    Route::get('criticalities', [CriticalityController::class, 'index']);

    // Read
    Route::get('incidents', [IncidentController::class, 'index']);
    Route::get('incidents/{incident}', [IncidentController::class, 'show']);

    // Write — engineers only
    Route::middleware('role:engineer')->group(function () {
        Route::post('incidents', [IncidentController::class, 'store']);
        Route::match(['put', 'patch'], 'incidents/{incident}', [IncidentController::class, 'update']);
        Route::delete('incidents/{incident}', [IncidentController::class, 'destroy']);

        Route::post('incidents/{incident}/timeline', [TimelineStepController::class, 'store']);
        Route::match(['put', 'patch'], 'incidents/{incident}/timeline/{step}', [TimelineStepController::class, 'update']);
        Route::delete('incidents/{incident}/timeline/{step}', [TimelineStepController::class, 'destroy']);

        Route::post('custom-field-definitions', [CustomFieldDefinitionController::class, 'store']);
        Route::match(['put', 'patch'], 'custom-field-definitions/{custom_field_definition}', [CustomFieldDefinitionController::class, 'update']);
        Route::delete('custom-field-definitions/{custom_field_definition}', [CustomFieldDefinitionController::class, 'destroy']);

        // Admin-editable dictionaries — write restricted, same as the frontend Admin screen
        foreach ([
            'services' => ServiceController::class,
            'zones' => ZoneController::class,
            'incident-types' => IncidentTypeController::class,
            'criticalities' => CriticalityController::class,
        ] as $prefix => $controller) {
            Route::post($prefix, [$controller, 'store']);
            Route::match(['put', 'patch'], "{$prefix}/{id}", [$controller, 'update']);
            Route::delete("{$prefix}/{id}", [$controller, 'destroy']);
        }
    });
});
