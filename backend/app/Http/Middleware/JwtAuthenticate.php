<?php

namespace App\Http\Middleware;

use App\Services\JwtService;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the bearer token to a user on every request (no cross-request
 * memoisation) and rejects the request when the token is missing, invalid,
 * expired or revoked.
 */
class JwtAuthenticate
{
    public function __construct(private readonly JwtService $jwt) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $this->jwt->resolveUser($request->bearerToken() ?? '');

        if (! $user) {
            throw new AuthenticationException('Unauthenticated.');
        }

        Auth::setUser($user);
        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
