<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Singleton settings row: one number, how many minutes an incident has from
 * detection to being handed off to the responsible party before SLA counts
 * as breached. `current()` is the only way in — callers never touch `id`.
 */
#[Fillable(['escalation_minutes'])]
class SlaSetting extends Model
{
    public const DEFAULT_ESCALATION_MINUTES = 30;

    protected function casts(): array
    {
        return ['escalation_minutes' => 'integer'];
    }

    public static function current(): self
    {
        return static::query()->firstOrCreate([], ['escalation_minutes' => self::DEFAULT_ESCALATION_MINUTES]);
    }
}
