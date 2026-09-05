<?php

namespace App\Http\Controllers;

use App\Models\IncidentType;

class IncidentTypeController extends LookupController
{
    protected function model(): string
    {
        return IncidentType::class;
    }
}
