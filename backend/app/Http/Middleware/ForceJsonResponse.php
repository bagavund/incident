<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * This is a JSON-only API: make every request declare that it expects JSON so
 * framework responses (validation errors, 401s, 404s) are rendered as JSON
 * instead of redirecting to a non-existent "login" route.
 */
class ForceJsonResponse
{
    public function handle(Request $request, Closure $next): Response
    {
        $request->headers->set('Accept', 'application/json');

        return $next($request);
    }
}
