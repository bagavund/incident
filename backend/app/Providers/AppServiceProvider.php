<?php

namespace App\Providers;

use App\Services\JwtService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(JwtService::class, fn () => JwtService::fromConfig());
    }

    public function boot(): void
    {
        // Политика паролей: на проде — 12+ символов, разный регистр, цифры и
        // проверка по базе утечек (k-anonymity HIBP). Вне прода не мешаем.
        Password::defaults(fn () => $this->app->isProduction()
            ? Password::min(12)->mixedCase()->numbers()->uncompromised()
            : Password::min(8));

        Auth::viaRequest('jwt', function (Request $request) {
            $token = $request->bearerToken();

            return $token
                ? $this->app->make(JwtService::class)->resolveUser($token)
                : null;
        });
    }
}
