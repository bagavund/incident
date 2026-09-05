<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;
use App\Enums\Concerns\LabeledEnum;

enum EscalationResult: string implements LabeledEnum
{
    use HasOptions;

    case Reached = 'reached';
    case NotReached = 'not_reached';
    case Redirected = 'redirected';

    public function label(): string
    {
        return match ($this) {
            self::Reached => 'Дозвонился',
            self::NotReached => 'Не дозвонился',
            self::Redirected => 'Переадресовал на другого ответственного',
        };
    }
}
