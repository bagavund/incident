<?php

namespace App\Models;

use App\Enums\EscalationChannel;
use App\Enums\EscalationKind;
use App\Enums\EscalationResult;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['incident_id', 'position', 'time', 'callee_name', 'kind', 'channel', 'result', 'attempts'])]
class EscalationAttempt extends Model
{
    protected function casts(): array
    {
        return [
            'kind' => EscalationKind::class,
            'channel' => EscalationChannel::class,
            'result' => EscalationResult::class,
            'attempts' => 'integer',
        ];
    }

    /** @return BelongsTo<Incident, $this> */
    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }
}
