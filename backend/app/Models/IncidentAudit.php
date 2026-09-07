<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One journal entry: an incident was created, updated, or deleted, by whom,
 * and — for updates — which top-level fields changed. Append-only from
 * IncidentController; nothing else writes to this table.
 */
class IncidentAudit extends Model
{
    public $timestamps = false;

    protected $fillable = ['incident_id', 'incident_code', 'incident_title', 'user_id', 'action', 'changes'];

    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Incident, $this> */
    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
