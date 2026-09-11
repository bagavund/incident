<?php

namespace App\Http\Requests;

use App\Enums\EscalationChannel;
use App\Enums\EscalationKind;
use App\Enums\EscalationResult;
use App\Enums\IncidentStatus;
use App\Enums\TimelineKind;
use App\Models\Incident;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if (! $user) {
            return false;
        }

        // Создать инцидент может любой, кроме viewer; редактировать — только
        // через IncidentPolicy (админ, автор записи, либо дежурный, вписанный
        // именно в этот инцидент).
        $incident = $this->route('incident');

        return $incident instanceof Incident ? $user->can('update', $incident) : $user->can('create', Incident::class);
    }

    public function rules(): array
    {
        $creating = $this->isMethod('post');

        // Полноту проверяем при создании и при апдейте, который явно несёт статус
        // (так фронт сохраняет форму) — частичный PATCH без статуса её не трогает.
        $carriesStatus = $this->filled('status');
        $publishing = ($creating || $carriesStatus)
            && $this->input('status') === IncidentStatus::Published->value;

        // Черновик требует только название; всё остальное обязательно лишь при публикации.
        $whenFull = $publishing ? 'required' : 'sometimes';
        $titleRule = $creating || $carriesStatus ? 'required' : 'sometimes';

        return [
            'title' => [$titleRule, 'string', 'max:255'],
            'services' => $publishing ? ['required', 'array', 'min:1'] : ['sometimes', 'array'],
            'services.*' => ['integer', Rule::exists('services', 'id')],
            'type' => [$whenFull, 'nullable', 'string', Rule::exists('incident_types', 'name')],
            'criticality' => [$whenFull, 'nullable', 'string', Rule::exists('criticalities', 'name')],
            'on_duty_user_id' => [$whenFull, 'nullable', 'integer', Rule::exists('users', 'id')],

            // sla клиентом не задаётся — его выносит SlaEvaluator на сервере.
            'status' => ['nullable', Rule::enum(IncidentStatus::class)],

            'started_at' => [$whenFull, 'nullable', 'date'],
            'detected_at' => ['nullable', 'date'],
            'resolved_at' => ['nullable', 'date', 'after_or_equal:started_at', Rule::requiredIf($publishing)],

            'stub_installed' => ['boolean'],
            'stub_on' => ['nullable', 'string', 'regex:/^\d{1,2}:\d{2}$/'],
            'stub_off' => ['nullable', 'string', 'regex:/^\d{1,2}:\d{2}$/'],

            'cause' => ['nullable', 'string'],
            'impact' => ['nullable', 'string', Rule::requiredIf($publishing)],
            // Только http/https — иначе поле утекает в href на фронте и даёт
            // javascript:/data: (stored XSS).
            'task_link' => ['nullable', 'string', 'max:2048', 'url:http,https'],

            // present пропускает [] («влияния не было»), но отклоняет null при публикации.
            'impact_targets' => [$publishing ? 'present' : 'nullable', 'array'],
            'impact_targets.*' => ['string', Rule::in(['site', 'app'])],

            'zones' => $publishing ? ['required', 'array', 'min:1'] : ['nullable', 'array'],
            'zones.*' => ['string', Rule::exists('zones', 'name')],

            'timeline' => ['nullable', 'array'],
            'timeline.*.id' => ['nullable', 'integer'],
            'timeline.*.kind' => ['required_with:timeline', Rule::enum(TimelineKind::class)],
            'timeline.*.action' => ['nullable', 'string'],
            'timeline.*.time' => ['nullable', 'string', 'regex:/^\d{1,2}:\d{2}$/'],
            'timeline.*.custom' => ['nullable', 'boolean'],
            'timeline.*.position' => ['nullable', 'integer', 'min:0'],

            'escalations' => ['nullable', 'array'],
            'escalations.*.id' => ['nullable', 'integer'],
            'escalations.*.time' => ['nullable', 'string', 'regex:/^\d{1,2}:\d{2}$/'],
            'escalations.*.callee_name' => ['nullable', 'string', 'max:255'],
            'escalations.*.kind' => ['required_with:escalations', Rule::enum(EscalationKind::class)],
            'escalations.*.channel' => ['required_with:escalations', Rule::enum(EscalationChannel::class)],
            'escalations.*.result' => ['required_with:escalations', Rule::enum(EscalationResult::class)],
            'escalations.*.attempts' => ['nullable', 'integer', 'min:1'],
            'escalations.*.position' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
