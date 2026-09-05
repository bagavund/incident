<?php

namespace App\Http\Controllers;

use App\Enums\EscalationChannel;
use App\Enums\EscalationKind;
use App\Enums\EscalationResult;
use App\Enums\IncidentSla;
use App\Enums\IncidentStatus;
use App\Enums\TimelineKind;
use App\Enums\UserRole;
use App\Http\Resources\CustomFieldDefinitionResource;
use App\Models\Criticality;
use App\Models\CustomFieldDefinition;
use App\Models\IncidentType;
use App\Models\Service;
use App\Models\Zone;
use Illuminate\Http\JsonResponse;

class MetaController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'custom_field_definitions' => CustomFieldDefinitionResource::collection(
                CustomFieldDefinition::query()->where('active', true)->orderBy('position')->get()
            ),
            'services' => Service::query()->orderBy('name')->pluck('name'),
            'zones' => Zone::query()->orderBy('name')->pluck('name'),
            'incident_types' => IncidentType::query()->orderBy('name')->pluck('name'),
            'criticalities' => Criticality::query()->orderBy('name')->pluck('name'),
            'incident_statuses' => IncidentStatus::options(),
            'incident_sla' => IncidentSla::options(),
            'timeline_kinds' => TimelineKind::options(),
            'timeline_required_kinds' => array_map(
                fn (TimelineKind $k) => $k->value,
                TimelineKind::required(),
            ),
            'escalation_kinds' => EscalationKind::options(),
            'escalation_channels' => EscalationChannel::options(),
            'escalation_results' => EscalationResult::options(),
            'user_roles' => UserRole::options(),
            'periods' => [
                ['value' => 7, 'label' => 'Последние 7 дней'],
                ['value' => 30, 'label' => 'Последние 30 дней'],
                ['value' => 90, 'label' => 'Последние 90 дней'],
                ['value' => 180, 'label' => 'Последние 180 дней'],
                ['value' => 365, 'label' => 'Последний год'],
                ['value' => 'custom', 'label' => 'Свой период'],
            ],
        ]);
    }
}
