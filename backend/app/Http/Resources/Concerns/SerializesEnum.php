<?php

namespace App\Http\Resources\Concerns;

use App\Enums\Concerns\LabeledEnum;

trait SerializesEnum
{
    /**
     * Backed enum → {value, label} — единая форма для всех ресурсов API.
     *
     * @param  LabeledEnum&\BackedEnum  $enum
     * @return array{value:int|string,label:string}
     */
    protected function enum($enum): array
    {
        return ['value' => $enum->value, 'label' => $enum->label()];
    }
}
