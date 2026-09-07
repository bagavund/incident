<?php

namespace App\Models;

use App\Enums\TimelineKind;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['incident_id', 'position', 'kind', 'action', 'occurred_at', 'custom'])]
class TimelineStep extends Model
{
    protected function casts(): array
    {
        return [
            'kind' => TimelineKind::class,
            'occurred_at' => 'datetime',
            'custom' => 'boolean',
        ];
    }

    /** @return BelongsTo<Incident, $this> */
    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }
}
