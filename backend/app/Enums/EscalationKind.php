<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;
use App\Enums\Concerns\LabeledEnum;

enum EscalationKind: string implements LabeledEnum
{
    use HasOptions;

    case Responsible = 'responsible';
    case Approval = 'approval';

    public function label(): string
    {
        return match ($this) {
            self::Responsible => 'Ответственный',
            self::Approval => 'Согласование',
        };
    }
}
