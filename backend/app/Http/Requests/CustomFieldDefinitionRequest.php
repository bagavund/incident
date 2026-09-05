<?php

namespace App\Http\Requests;

use App\Enums\CustomFieldType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class CustomFieldDefinitionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isEngineer() ?? false;
    }

    public function rules(): array
    {
        $creating = $this->isMethod('post');
        $id = $this->route('custom_field_definition')?->id;

        return [
            'key' => [
                $creating ? 'required' : 'sometimes',
                'string', 'max:120', 'regex:/^[a-z][a-z0-9_]*$/',
                Rule::unique('custom_field_definitions', 'key')->ignore($id),
            ],
            'label' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'type' => [$creating ? 'required' : 'sometimes', Rule::enum(CustomFieldType::class)],
            'options' => ['nullable', 'array'],
            'options.*' => ['string', 'max:120'],
            'required' => ['boolean'],
            'active' => ['boolean'],
            'position' => ['nullable', 'integer', 'min:0'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            $type = $this->input('type');
            $options = $this->input('options');

            if ($type === CustomFieldType::Select->value && empty($options)) {
                $v->errors()->add('options', 'Для типа «Список» нужно указать хотя бы одну опцию.');
            }
        });
    }
}
