<?php

namespace App\Http\Controllers;

use App\Models\Criticality;

class CriticalityController extends LookupController
{
    protected function model(): string
    {
        return Criticality::class;
    }
}
