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
// throttle: защита от брутфорса пароля — 5 попыток в минуту на IP+логин.
Route::post('auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:5,1');

/*
|--------------------------------------------------------------------------
| Authenticated (JWT)
|--------------------------------------------------------------------------
*/
Route::middleware('auth.jwt')->group(function () {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::post('auth/refresh', [AuthController::class, 'refresh'])
        ->middleware('throttle:10,1');
    Route::post('auth/password', [AuthController::class, 'changePassword'])
        ->middleware('throttle:5,1');

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
    Route::get('incidents/{incident}/pdf', [IncidentController::class, 'pdf']);

    // Создать инцидент может любой, кроме viewer; редактирование/удаление
    // разбирает IncidentPolicy внутри контроллера/IncidentRequest (админ —
    // любой инцидент, автор записи или вписанный дежурный — свой).
    Route::post('incidents', [IncidentController::class, 'store']);
    Route::match(['put', 'patch'], 'incidents/{incident}', [IncidentController::class, 'update']);
    Route::delete('incidents/{incident}', [IncidentController::class, 'destroy']);

    // Управление системой — только администратор
    Route::middleware('role:admin')->group(function () {
        Route::get('incidents/{incident}/audit', [IncidentController::class, 'audit']);

        Route::post('users', [UserController::class, 'store']);
        Route::match(['put', 'patch'], 'users/{user}/password', [UserController::class, 'resetPassword']);

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
