<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    /**
     * Usage: ->middleware('role:engineer') or 'role:engineer,viewer'.
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            abort(401, 'Требуется авторизация.');
        }

        if ($roles && ! in_array($user->role->value, $roles, true)) {
            abort(403, 'Недостаточно прав для этого действия.');
        }

        return $next($request);
    }
}
