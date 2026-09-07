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

            $old = $before[$field] ?? null;
            if ((string) $old !== (string) $value) {
                $changes[$field] = [$old, $value];
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
