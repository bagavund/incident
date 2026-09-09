<?php

namespace App\Http\Controllers;

use App\Models\Concerns\LookupValue;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * Shared CRUD for the small admin-editable dictionaries (services, zones,
 * incident types, criticalities). Add/rename are case-insensitive-unique;
 * delete is blocked while any incident still references the value; rename
 * cascades into the incidents that reference the old value.
 */
abstract class LookupController extends Controller
{
    /** @return class-string<Model&LookupValue> */
    abstract protected function model(): string;

    /**
     * Одна строка справочника в ответе API. Справочники с доп. полями
     * (например, категория у типов инцидентов) переопределяют этот метод.
     *
     * @return array<string,mixed>
     */
    protected function rowPayload(Model $row): array
    {
        return [
            'id' => $row->id,
            'name' => $row->name,
            'usage_count' => $row->usageCount(),
        ];
    }

    /**
     * Доп. атрибуты помимо name, которые справочник принимает на запись.
     *
     * @return array<string,mixed>
     */
    protected function extraAttributes(Request $request): array
    {
        return [];
    }

    public function index(): JsonResponse
    {
        $model = $this->model();

        $rows = $model::query()->orderBy('name')->get()->map(fn (Model $m) => $this->rowPayload($m));

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $model = $this->model();
        $name = $this->validateName($request);

        if ($this->findByName($name)) {
            return response()->json([
                'message' => 'Значение с таким названием уже существует.',
                'errors' => ['name' => ['Значение с таким названием уже существует.']],
            ], 422);
        }

        $row = $model::create(['name' => $name, ...$this->extraAttributes($request)]);

        return response()->json(['data' => $this->rowPayload($row)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $model = $this->model();
        $row = $model::query()->findOrFail($id);
        $name = $this->validateName($request);

        $collision = $this->findByName($name);
        if ($collision && $collision->id !== $row->id) {
            return response()->json([
                'message' => 'Значение с таким названием уже существует.',
                'errors' => ['name' => ['Значение с таким названием уже существует.']],
            ], 422);
        }

        $extra = $this->extraAttributes($request);

        DB::transaction(function () use ($row, $name, $extra) {
            $row->renameUsagesTo($name);
            $row->update(['name' => $name, ...$extra]);
        });

        return response()->json(['data' => $this->rowPayload($row)]);
    }

    public function destroy(int $id): Response|JsonResponse
    {
        $model = $this->model();
        $row = $model::query()->findOrFail($id);
        $count = $row->usageCount();

        if ($count > 0) {
            return response()->json([
                'message' => "«{$row->name}» используется в {$count} инцидент(ах) — удаление недоступно.",
            ], 409);
        }

        $row->delete();

        return response()->noContent();
    }

    private function validateName(Request $request): string
    {
        return trim($request->validate([
            'name' => ['required', 'string', 'max:120'],
        ])['name']);
    }

    /**
     * Case-insensitive lookup done in PHP rather than SQL: SQLite's LOWER()
     * only folds ASCII, which would silently miss collisions on Cyrillic names.
     */
    private function findByName(string $name): ?Model
    {
        $model = $this->model();
        $needle = mb_strtolower($name);

        return $model::query()->get()->first(fn (Model $m) => mb_strtolower($m->name) === $needle);
    }
}
