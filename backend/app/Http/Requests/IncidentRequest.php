<?php

namespace App\Http\Requests;

use App\Enums\EscalationChannel;
use App\Enums\EscalationKind;
use App\Enums\EscalationResult;
use App\Enums\IncidentSla;
use App\Enums\IncidentStatus;
use App\Enums\TimelineKind;
use App\Models\CustomFieldDefinition;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class IncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isEngineer() ?? false;
    }

    public function rules(): array
    {
        $creating = $this->isMethod('post');
        $required = $creating ? 'required' : 'sometimes';

        return [
            'title' => [$required, 'string', 'max:255'],
            'services' => [$required, 'array', 'min:1'],
            'services.*' => ['integer', Rule::exists('services', 'id')],
            'type' => [$required, 'string', Rule::exists('incident_types', 'name')],
            'criticality' => [$required, 'string', Rule::exists('criticalities', 'name')],
            'on_duty_name' => [$required, 'string', 'max:255'],

            'status' => ['nullable', Rule::enum(IncidentStatus::class)],
            'sla' => ['nullable', Rule::enum(IncidentSla::class)],

            'started_at' => [$required, 'date'],
            'detected_at' => ['nullable', 'date'],
            'resolved_at' => ['nullable', 'date', 'after_or_equal:started_at'],

            'stub_installed' => ['boolean'],
            'stub_on' => ['nullable', 'string', 'regex:/^\d{1,2}:\d{2}$/'],
            'stub_off' => ['nullable', 'string', 'regex:/^\d{1,2}:\d{2}$/'],

            'cause' => ['nullable', 'string'],
            'impact' => ['nullable', 'string'],
            'task_link' => ['nullable', 'string', 'max:2048'],

            'zones' => ['nullable', 'array'],
            'zones.*' => ['string', Rule::exists('zones', 'name')],

            'custom_fields' => ['nullable', 'array'],

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

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            if (! $this->has('custom_fields')) {
                return;
            }

            $values = (array) $this->input('custom_fields', []);
            $definitions = CustomFieldDefinition::query()->where('active', true)->get()->keyBy('key');

            // Значение по неизвестному/архивному ключу — отклоняем, а не молча игнорируем.
            foreach (array_keys($values) as $key) {
                if (! $definitions->has($key)) {
                    $v->errors()->add("custom_fields.{$key}", 'Неизвестное или архивное поле.');
                }
            }

            foreach ($definitions as $key => $definition) {
                $fieldValidator = ValidatorFacade::make(
                    [$key => $values[$key] ?? null],
                    [$key => $definition->valueRules()],
                );

                if ($fieldValidator->fails()) {
                    foreach ($fieldValidator->errors()->get($key) as $message) {
                        $v->errors()->add("custom_fields.{$key}", $message);
                    }
                }
            }
        });
    }
}
