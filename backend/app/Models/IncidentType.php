<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name'])]
class IncidentType extends Model
{
    use HasFactory;

    /** Сколько инцидентов ссылаются на этот тип (хранится как свободный текст на инциденте). */
    public function usageCount(): int
    {
        return Incident::query()->where('type', $this->name)->count();
    }
}
