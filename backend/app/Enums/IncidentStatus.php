<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;
use App\Enums\Concerns\LabeledEnum;

enum IncidentStatus: string implements LabeledEnum
{
    use HasOptions;

    /** Постмортем не заполнен (не хватает причины) — виден только создателю. */
    case Draft = 'draft';

    /** Постмортем заполнен и опубликован. */
    case Published = 'published';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Черновик',
            self::Published => 'Опубликован',
        };
    }
}
