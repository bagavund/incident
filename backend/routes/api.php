<?php

use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CriticalityController;
use App\Http\Controllers\IncidentController;
use App\Http\Controllers\IncidentTypeController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\SlaSettingController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\ZoneController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public
|--------------------------------------------------------------------------
*/
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

    Route::get('analytics/dashboard', [AnalyticsController::class, 'dashboard']);

    Route::get('sla-setting', [SlaSettingController::class, 'show']);

    // Список нужен всем — им заполняется выбор дежурного в форме инцидента.
    Route::get('users', [UserController::class, 'index']);

    // Admin-editable dictionaries — read for everyone
    Route::get('services', [ServiceController::class, 'index']);
    Route::get('zones', [ZoneController::class, 'index']);
    Route::get('incident-types', [IncidentTypeController::class, 'index']);
    Route::get('criticalities', [CriticalityController::class, 'index']);

    // Read
    Route::get('incidents', [IncidentController::class, 'index']);
    Route::get('incidents/{incident}', [IncidentController::class, 'show']);
    Route::get('incidents/{incident}/audit', [IncidentController::class, 'audit']);

    // Создать инцидент может любой авторизованный (админ или дежурный);
    // редактирование/удаление разбирает IncidentPolicy внутри контроллера
    // (админ — любой инцидент, дежурный — только тот, где сам вписан).
    Route::post('incidents', [IncidentController::class, 'store']);
    Route::match(['put', 'patch'], 'incidents/{incident}', [IncidentController::class, 'update']);
    Route::delete('incidents/{incident}', [IncidentController::class, 'destroy']);

    // Управление системой — только администратор
    Route::middleware('role:admin')->group(function () {
        Route::post('users', [UserController::class, 'store']);

        Route::match(['put', 'patch'], 'sla-setting', [SlaSettingController::class, 'update']);

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
