<?php

namespace App\Models;

use App\Models\Concerns\LookupValue;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['name'])]
class Service extends Model implements LookupValue
{
    use HasFactory;

    /** @return BelongsToMany<Incident, $this> */
    public function incidents(): BelongsToMany
    {
        return $this->belongsToMany(Incident::class);
    }

    public function usageCount(): int
    {
        return $this->incidents()->count();
    }

    /** Инциденты ссылаются на сервис через pivot по id — переименование ничего не ломает. */
    public function renameUsagesTo(string $newName): void
    {
        // no-op
    }
}
