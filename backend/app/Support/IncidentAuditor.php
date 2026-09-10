<?php

namespace App\Support;

use App\Models\Incident;
use App\Models\IncidentAudit;
use App\Models\User;

/**
 * Writes to incident_audits. Update entries record only what actually
 * changed — comparing an attribute snapshot taken before the write against
 * the incident's state after it — so the journal stays legible on an incident
 * that's had dozens of edits instead of repeating every field every time.
 */
final class IncidentAuditor
{
    /** Fields not worth ever showing on a change record. */
    private const IGNORED = ['id', 'code', 'created_at', 'updated_at'];

    public static function created(Incident $incident, ?User $user): void
    {
        self::write($incident, $user, 'created', null);
    }

    public static function deleted(Incident $incident, ?User $user): void
    {
        self::write($incident, $user, 'deleted', null);
    }

    /**
     * @param  array<string,mixed>  $before  Incident attributes as they were before this write.
     * @param  list<int>  $beforeServiceIds
     * @param  list<int>  $afterServiceIds
     */
    public static function updated(
        Incident $incident,
        ?User $user,
        array $before,
        array $beforeServiceIds,
        array $afterServiceIds,
    ): void {
        $after = $incident->getAttributes();
        $changes = [];

        foreach ($after as $field => $value) {
            if (in_array($field, self::IGNORED, true)) {
                continue;
            }

            $old = self::normalize($before[$field] ?? null);
            $new = self::normalize($value);
            if ($old !== $new) {
                $changes[$field] = [$old, $new];
            }
        }

        sort($beforeServiceIds);
        sort($afterServiceIds);
        if ($beforeServiceIds !== $afterServiceIds) {
            $changes['services'] = [$beforeServiceIds, $afterServiceIds];
        }

        if ($changes === []) {
            return;
        }

        self::write($incident, $user, 'updated', $changes);
    }

    /**
     * Prepare a raw attribute value for both diffing and storage.
     *
     * The snapshot taken before the write holds raw DB values, the state after it
     * holds cast values, and the two encode the same data differently:
     *  - JSON columns come back from MySQL with a space after each comma
     *    ('["site", "app"]') but Laravel's encoder writes none ('["site","app"]');
     *  - a boolean column reads back as 0/1 and casts to false/true.
     * A plain string compare then reports a change on every save. Folding both
     * sides to a canonical form removes the false positives; JSON is kept decoded
     * so the journal stores real arrays.
     */
    private static function normalize(mixed $value): mixed
    {
        if (is_string($value)) {
            $trimmed = ltrim($value);
            if (isset($trimmed[0]) && ($trimmed[0] === '[' || $trimmed[0] === '{')) {
                $decoded = json_decode($value, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    return $decoded;
                }
            }

            return $value;
        }

        if (is_array($value) || $value === null) {
            return $value;
        }

        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        return (string) $value;
    }

    private static function write(Incident $incident, ?User $user, string $action, ?array $changes): void
    {
        IncidentAudit::create([
            'incident_id' => $incident->id,
            'incident_code' => $incident->code,
            'incident_title' => $incident->title,
            'user_id' => $user?->id,
            'action' => $action,
            'changes' => $changes,
        ]);
    }
}
