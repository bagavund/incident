<?php

use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\ForceJsonResponse;
use App\Http\Middleware\JwtAuthenticate;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: 'api',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // За реверс-прокси/балансировщиком (прод: HTTPS терминируется там):
        // доверяем заголовкам X-Forwarded-*, иначе Laravel считает соединение
        // http и ломает абсолютные ссылки, а троттлинг ключуется по IP прокси.
        // Доверяемые адреса при желании сузить через env TRUSTED_PROXIES.
        $middleware->trustProxies(
            at: env('TRUSTED_PROXIES') ? explode(',', env('TRUSTED_PROXIES')) : '*',
        );

        $middleware->api(prepend: [ForceJsonResponse::class]);

        $middleware->alias([
            'auth.jwt' => JwtAuthenticate::class,
            'role' => EnsureRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
