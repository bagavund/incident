<?php

return [

    /*
    | Secret used to sign tokens (HS256). Falls back to APP_KEY for local dev
    | convenience, but on production JWT_SECRET must be set explicitly — иначе
    | компрометация APP_KEY = компрометация всех токенов, и наоборот.
    | Пустой секрет на проде → JwtService бросает RuntimeException при загрузке.
    */
    'secret' => env('JWT_SECRET') ?: (env('APP_ENV') === 'production' ? '' : env('APP_KEY')),

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
