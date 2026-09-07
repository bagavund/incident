<?php

namespace App\Models;

use App\Models\Concerns\LookupValue;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name'])]
class Criticality extends Model implements LookupValue
{
    use HasFactory;

    /** Сколько инцидентов ссылаются на это значение (хранится как свободный текст на инциденте). */
    public function usageCount(): int
    {
        return Incident::query()->where('criticality', $this->name)->count();
    }

    public function renameUsagesTo(string $newName): void
    {
        Incident::query()->where('criticality', $this->name)->update(['criticality' => $newName]);
    }
}
