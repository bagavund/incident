<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;
use App\Enums\Concerns\LabeledEnum;

enum EscalationChannel: string implements LabeledEnum
{
    use HasOptions;

    case Phone = 'phone';
    case Telegram = 'telegram';
    case YandexMessenger = 'yandex_messenger';
    case Mail = 'mail';

    public function label(): string
    {
        return match ($this) {
            self::Phone => 'Телефон',
            self::Telegram => 'Telegram',
            self::YandexMessenger => 'Яндекс мессенджер',
            self::Mail => 'Почта',
        };
    }
}
