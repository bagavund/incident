<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;
use App\Enums\Concerns\LabeledEnum;

enum UserRole: string implements LabeledEnum
{
    use HasOptions;

    /** Может создавать и редактировать инциденты. */
    case Engineer = 'engineer';

    /** Только просмотр. */
    case Viewer = 'viewer';

    public function label(): string
    {
        return match ($this) {
            self::Engineer => 'Инженер',
            self::Viewer => 'Наблюдатель',
        };
    }
}
