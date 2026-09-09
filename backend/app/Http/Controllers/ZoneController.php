<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\CategorizedLookup;
use App\Models\Zone;

class ZoneController extends LookupController
{
    use CategorizedLookup;

    protected function model(): string
    {
        return Zone::class;
    }
}
