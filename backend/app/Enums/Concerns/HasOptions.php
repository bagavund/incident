<?php

namespace App\Enums\Concerns;

trait HasOptions
{
    /** @return list<array{value:string,label:string}> */
    public static function options(): array
    {
        return array_map(
            fn (self $case) => ['value' => $case->value, 'label' => $case->label()],
            self::cases(),
        );
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }

    public function payload(): array
    {
        return ['value' => $this->value, 'label' => $this->label()];
    }
}
