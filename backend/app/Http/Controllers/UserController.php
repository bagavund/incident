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
}
