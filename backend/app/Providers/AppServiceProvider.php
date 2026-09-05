<?php

namespace App\Providers;

use App\Services\JwtService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(JwtService::class, fn () => JwtService::fromConfig());
    }

    public function boot(): void
    {
        Auth::viaRequest('jwt', function (Request $request) {
            $token = $request->bearerToken();

            return $token
                ? $this->app->make(JwtService::class)->resolveUser($token)
                : null;
        });
    }
}
