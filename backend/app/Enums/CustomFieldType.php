<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;
use App\Enums\Concerns\LabeledEnum;

enum CustomFieldType: string implements LabeledEnum
{
    use HasOptions;

    case Text = 'text';
    case Number = 'number';
    case Select = 'select';
    case Checkbox = 'checkbox';
    case Date = 'date';

    public function label(): string
    {
        return match ($this) {
            self::Text => 'Текст',
            self::Number => 'Число',
            self::Select => 'Список',
            self::Checkbox => 'Чекбокс',
            self::Date => 'Дата',
        };
    }

    /** Типы, для которых обязателен непустой список options. */
    public function requiresOptions(): bool
    {
        return $this === self::Select;
    }

    /** Единый набор правил валидации значения этого поля (для Validator::make). */
    public function valueRules(): array
    {
        return match ($this) {
            self::Text => ['string', 'max:1000'],
            self::Number => ['numeric'],
            self::Select => ['string'],
            self::Checkbox => ['boolean'],
            self::Date => ['date'],
        };
    }
}
