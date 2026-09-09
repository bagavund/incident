<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\CategorizedLookup;
use App\Models\IncidentType;

class IncidentTypeController extends LookupController
{
    use CategorizedLookup;

    protected function model(): string
    {
        return IncidentType::class;
    }
}
