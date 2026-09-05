<?php

return [

    /*
    | Secret used to sign tokens (HS256). Falls back to APP_KEY so the app
    | still boots without an explicit JWT_SECRET, but set one in production.
    */
    'secret' => env('JWT_SECRET', env('APP_KEY')),

    /*
    | Access token lifetime, in minutes.
    */
    'ttl' => (int) env('JWT_TTL', 60 * 12),

    /*
    | How long after expiry a token may still be exchanged via /auth/refresh,
    | in minutes.
    */
    'refresh_ttl' => (int) env('JWT_REFRESH_TTL', 60 * 24 * 14),

    'issuer' => env('APP_URL', 'ims-backend'),

    /*
    | Clock skew tolerance, in seconds.
    */
    'leeway' => (int) env('JWT_LEEWAY', 30),
];
