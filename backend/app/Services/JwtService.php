<?php

namespace App\Services;

use App\Models\User;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use RuntimeException;
use stdClass;

/**
 * Thin HS256 JWT layer: issue / verify access tokens and keep a denylist of
 * revoked token ids (used by /auth/logout) in the cache until they expire.
 */
class JwtService
{
    private const ALG = 'HS256';

    private const DENYLIST_PREFIX = 'jwt:denied:';

    public function __construct(
        private readonly string $secret,
        private readonly int $ttlMinutes,
        private readonly int $refreshTtlMinutes,
        private readonly string $issuer,
        private readonly int $leeway,
    ) {
        if ($this->secret === '') {
            throw new RuntimeException('JWT secret is not configured. Set JWT_SECRET in .env.');
        }
    }

    public static function fromConfig(): self
    {
        return new self(
            (string) config('jwt.secret'),
            (int) config('jwt.ttl'),
            (int) config('jwt.refresh_ttl'),
            (string) config('jwt.issuer'),
            (int) config('jwt.leeway'),
        );
    }

    /** @return array{token:string,expires_in:int,expires_at:int} */
    public function issue(User $user): array
    {
        $now = time();
        $exp = $now + $this->ttlMinutes * 60;

        $token = JWT::encode([
            'iss' => $this->issuer,
            'sub' => $user->getKey(),
            'role' => $user->role->value,
            'jti' => (string) Str::uuid(),
            'iat' => $now,
            'nbf' => $now,
            'exp' => $exp,
        ], $this->secret, self::ALG);

        return [
            'token' => $token,
            'expires_in' => $this->ttlMinutes * 60,
            'expires_at' => $exp,
        ];
    }

    /**
     * Decode and validate a token. Throws on any failure (bad signature,
     * expired, malformed).
     *
     * @return array<string,mixed>
     */
    public function decode(string $token, bool $allowExpired = false): array
    {
        JWT::$leeway = $this->leeway;

        if ($allowExpired) {
            return $this->decodeIgnoringExpiry($token);
        }

        /** @var stdClass $payload */
        $payload = JWT::decode($token, new Key($this->secret, self::ALG));

        return (array) $payload;
    }

    /** @return array<string,mixed> */
    private function decodeIgnoringExpiry(string $token): array
    {
        [$headB64, $bodyB64, $sigB64] = array_pad(explode('.', $token), 3, '');
        $expected = JWT::urlsafeB64Encode(hash_hmac(
            'sha256',
            "{$headB64}.{$bodyB64}",
            $this->secret,
            true,
        ));

        if (! hash_equals($expected, $sigB64)) {
            throw new RuntimeException('Invalid token signature.');
        }

        $body = json_decode(JWT::urlsafeB64Decode($bodyB64), true) ?: [];

        // Still enforce the refresh window.
        if (isset($body['iat']) && time() - (int) $body['iat'] > $this->refreshTtlMinutes * 60) {
            throw new RuntimeException('Token is outside the refresh window.');
        }

        return $body;
    }

    public function revoke(string $jti, int $expiresAt): void
    {
        $ttl = max(1, $expiresAt - time());
        Cache::put(self::DENYLIST_PREFIX.$jti, true, $ttl);
    }

    public function isRevoked(string $jti): bool
    {
        return $jti !== '' && Cache::has(self::DENYLIST_PREFIX.$jti);
    }

    public function resolveUser(string $token): ?User
    {
        try {
            $payload = $this->decode($token);
        } catch (\Throwable) {
            return null;
        }

        if ($this->isRevoked((string) ($payload['jti'] ?? ''))) {
            return null;
        }

        return User::find($payload['sub'] ?? null);
    }
}
