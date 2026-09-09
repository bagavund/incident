<?php

namespace App\Http\Controllers\Concerns;

use App\Enums\ProblemCategory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Справочник с колонкой `category` (ProblemCategory): типы инцидентов и зоны
 * ответственности. Отдаёт категорию в ответе и принимает её на запись.
 */
trait CategorizedLookup
{
    /** @return array<string,mixed> */
    protected function rowPayload(Model $row): array
    {
        return [
            ...parent::rowPayload($row),
            'category' => ($row->category ?? ProblemCategory::Internal)->value,
        ];
    }

    /**
     * Категория опциональна: при создании без неё — «на нашей стороне» (совпадает
     * с дефолтом БД), при переименовании отсутствие категории её не трогает.
     *
     * @return array<string,mixed>
     */
    protected function extraAttributes(Request $request): array
    {
        $validated = $request->validate([
            'category' => ['sometimes', Rule::enum(ProblemCategory::class)],
        ]);

        if (array_key_exists('category', $validated)) {
            return ['category' => $validated['category']];
        }

        return $request->isMethod('post') ? ['category' => ProblemCategory::Internal->value] : [];
    }
}
