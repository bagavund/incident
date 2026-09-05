<?php

namespace App\Http\Requests;

use App\Enums\TimelineKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TimelineStepRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isEngineer() ?? false;
    }

    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'kind' => [$required, Rule::enum(TimelineKind::class)],
            'action' => ['nullable', 'string'],
            'time' => ['nullable', 'string', 'regex:/^\d{1,2}:\d{2}$/'],
            'custom' => ['nullable', 'boolean'],
            'position' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
