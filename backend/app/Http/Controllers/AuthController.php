<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\JwtService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly JwtService $jwt) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('username', $request->string('username'))->first();

        if (! $user || ! Hash::check($request->string('password'), $user->password)) {
            throw ValidationException::withMessages([
                'username' => ['Неверный логин или пароль.'],
            ]);
        }

        return $this->tokenResponse($user);
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    public function logout(Request $request): JsonResponse
    {
        $payload = $this->jwt->decode($request->bearerToken() ?? '', allowExpired: true);

        if (! empty($payload['jti']) && ! empty($payload['exp'])) {
            $this->jwt->revoke($payload['jti'], (int) $payload['exp']);
        }

        return response()->json(['message' => 'Сессия завершена.']);
    }

    public function refresh(Request $request): JsonResponse
    {
        $token = $request->bearerToken() ?? '';

        try {
            $payload = $this->jwt->decode($token, allowExpired: true);
        } catch (\Throwable $e) {
            throw ValidationException::withMessages(['token' => [$e->getMessage()]]);
        }

        if (! empty($payload['jti']) && $this->jwt->isRevoked($payload['jti'])) {
            throw ValidationException::withMessages(['token' => ['Токен отозван.']]);
        }

        $user = User::findOrFail($payload['sub'] ?? null);

        if (! empty($payload['jti']) && ! empty($payload['exp'])) {
            $this->jwt->revoke($payload['jti'], (int) $payload['exp']);
        }

        return $this->tokenResponse($user);
    }

    private function tokenResponse(User $user, int $status = 200): JsonResponse
    {
        $issued = $this->jwt->issue($user);

        return response()->json([
            'token' => $issued['token'],
            'token_type' => 'bearer',
            'expires_in' => $issued['expires_in'],
            'user' => new UserResource($user),
        ], $status);
    }
}
