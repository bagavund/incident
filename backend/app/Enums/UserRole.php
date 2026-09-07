<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;
use App\Enums\Concerns\LabeledEnum;

enum UserRole: string implements LabeledEnum
{
    use HasOptions;

    /** Полный доступ: правит любой инцидент, управляет справочниками, SLA и пользователями. */
    case Admin = 'admin';

    /** Создаёт инциденты; редактировать/удалять может только те, где сам вписан дежурным. */
    case OnDuty = 'on_duty';

    public function label(): string
    {
        return match ($this) {
            self::Admin => 'Администратор',
            self::OnDuty => 'Дежурный',
        };
    }
}
