<?php

namespace App\Http\Controllers;

use App\Models\Zone;

class ZoneController extends LookupController
{
    protected function model(): string
    {
        return Zone::class;
    }
}
