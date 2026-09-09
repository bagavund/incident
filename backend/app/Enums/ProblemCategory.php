<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;
use App\Enums\Concerns\LabeledEnum;

/**
 * Категория проблемы — совпадает со значением поля «Тип» инцидента и делит
 * зоны ответственности: внешняя проблема → свои зоны, на нашей стороне → свои.
 */
enum ProblemCategory: string implements LabeledEnum
{
    use HasOptions;

    case External = 'external';
    case Internal = 'internal';

    public function label(): string
    {
        return match ($this) {
            self::External => 'Внешняя проблема',
            self::Internal => 'Проблема на нашей стороне',
        };
    }
}
