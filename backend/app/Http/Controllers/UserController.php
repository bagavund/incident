<?php

namespace App\Http\Controllers;

use App\Http\Requests\CreateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class UserController extends Controller
{
    /**
     * Список нужен любому авторизованному — им заполняется выбор дежурного
     * при создании/редактировании инцидента, а не только экран администратора.
     */
    public function index(): AnonymousResourceCollection
    {
        return UserResource::collection(User::query()->orderBy('name')->get());
    }

    public function store(CreateUserRequest $request): UserResource
    {
        $user = User::create([
            'name' => $request->string('name'),
            'username' => $request->string('username'),
            'password' => $request->string('password'),
            'position' => $request->input('position'),
            'role' => $request->input('role'),
        ]);

        return new UserResource($user);
    }

    /**
     * Сброс пароля пользователя администратором (роут под role:admin).
     * Все активные токены этого юзера продолжают жить до истечения — при
     * компрометации админ дополнительно заводит новую учётку/делит роль.
     */
    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $user->update(['password' => $validated['password']]);

        return response()->json(['message' => 'Пароль обновлён.']);
    }
}
