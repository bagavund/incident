<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name'])]
class Zone extends Model
{
    use HasFactory;

    /** Сколько инцидентов ссылаются на эту зону (значение хранится как строка в JSON-массиве). */
    public function usageCount(): int
    {
        return Incident::query()->whereJsonContains('zones', $this->name)->count();
    }
}
