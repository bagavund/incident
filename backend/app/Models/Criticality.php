<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name'])]
class Criticality extends Model
{
    use HasFactory;

    /** Сколько инцидентов ссылаются на эту критичность (хранится как свободный текст на инциденте). */
    public function usageCount(): int
    {
        return Incident::query()->where('criticality', $this->name)->count();
    }
}
