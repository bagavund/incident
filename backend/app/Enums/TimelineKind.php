<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;
use App\Enums\Concerns\LabeledEnum;

enum TimelineKind: string implements LabeledEnum
{
    use HasOptions;

    case Detected = 'detected';
    case Diagnosis = 'diagnosis';
    case HandedOff = 'handed_off';
    case Informed = 'informed';
    case WarRoom = 'war_room';
    case Resolved = 'resolved';

    public function label(): string
    {
        return match ($this) {
            self::Detected => 'Обнаружено',
            self::Diagnosis => 'Диагностика',
            self::HandedOff => 'Проблема передана ответственным',
            self::Informed => 'Информирование',
            self::WarRoom => 'Собран war room',
            self::Resolved => 'Решена',
        };
    }

    /** Обязательные типы шагов постмортема, в порядке следования. */
    public static function required(): array
    {
        return [self::Detected, self::Diagnosis, self::HandedOff, self::Resolved];
    }
}
