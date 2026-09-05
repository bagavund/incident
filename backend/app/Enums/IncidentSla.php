<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;
use App\Enums\Concerns\LabeledEnum;

enum IncidentSla: string implements LabeledEnum
{
    use HasOptions;

    case Met = 'met';
    case Breached = 'breached';

    public function label(): string
    {
        return match ($this) {
            self::Met => 'Соблюден',
            self::Breached => 'Нарушен',
        };
    }
}
