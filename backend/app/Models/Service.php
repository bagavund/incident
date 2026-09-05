<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['name'])]
class Service extends Model
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
}
