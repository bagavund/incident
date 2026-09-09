<?php

namespace App\Models;

use App\Enums\ProblemCategory;
use App\Models\Concerns\LookupValue;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'category'])]
class Zone extends Model implements LookupValue
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'category' => ProblemCategory::class,
        ];
    }

    /** Сколько инцидентов ссылаются на эту зону (значение хранится как строка в JSON-массиве). */
    public function usageCount(): int
    {
        return Incident::query()->whereJsonContains('zones', $this->name)->count();
    }

    /**
     * Зоны лежат в JSON-массиве, поэтому массовый UPDATE не подходит: переписываем
     * каждый затронутый инцидент, сохраняя порядок и не плодя дубликатов.
     */
    public function renameUsagesTo(string $newName): void
    {
        Incident::query()
            ->whereJsonContains('zones', $this->name)
            ->get()
            ->each(function (Incident $incident) use ($newName) {
                $zones = array_values(array_unique(array_map(
                    fn (string $zone) => $zone === $this->name ? $newName : $zone,
                    $incident->zones ?? [],
                )));

                $incident->update(['zones' => $zones]);
            });
    }
}
