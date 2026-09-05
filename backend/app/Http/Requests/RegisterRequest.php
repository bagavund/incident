<?php

namespace App\Http\Requests;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // Only an authenticated engineer may choose the role of a new account;
        // open self-registration always yields a viewer.
        $mayPickRole = $this->user()?->isEngineer() ?? false;

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'confirmed', Password::defaults()],
            'position' => ['nullable', 'string', 'max:255'],
            'role' => [$mayPickRole ? 'nullable' : 'prohibited', Rule::enum(UserRole::class)],
        ];
    }
}
