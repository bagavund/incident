<?php

namespace App\Http\Controllers;

use App\Models\Service;

class ServiceController extends LookupController
{
    protected function model(): string
    {
        return Service::class;
    }
}
