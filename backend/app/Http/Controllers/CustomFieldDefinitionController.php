<?php

namespace App\Http\Controllers;

use App\Http\Requests\CustomFieldDefinitionRequest;
use App\Http\Resources\CustomFieldDefinitionResource;
use App\Models\CustomFieldDefinition;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class CustomFieldDefinitionController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return CustomFieldDefinitionResource::collection(
            CustomFieldDefinition::query()->orderBy('position')->orderBy('id')->get()
        );
    }

    public function store(CustomFieldDefinitionRequest $request): CustomFieldDefinitionResource
    {
        $data = $request->validated();

        $field = CustomFieldDefinition::create([
            ...$data,
            'position' => $data['position'] ?? ((CustomFieldDefinition::max('position') ?? 0) + 1),
        ]);

        return new CustomFieldDefinitionResource($field);
    }

    public function update(CustomFieldDefinitionRequest $request, CustomFieldDefinition $customFieldDefinition): CustomFieldDefinitionResource
    {
        // Тип поля и его ключ не меняем, если по нему уже есть данные — иначе значения
        // в incidents.custom_fields рассинхронизируются с ожидаемым типом/опциями.
        $data = $request->validated();

        if ($customFieldDefinition->hasValues()) {
            unset($data['type'], $data['key']);
        }

        $customFieldDefinition->fill($data)->save();

        return new CustomFieldDefinitionResource($customFieldDefinition);
    }

    public function destroy(CustomFieldDefinition $customFieldDefinition): Response
    {
        // Мягкое удаление: если по полю уже есть данные, просто прячем его из формы
        // и графиков, не теряя историю в existing incidents.custom_fields.
        if ($customFieldDefinition->hasValues()) {
            $customFieldDefinition->update(['active' => false]);

            return response()->noContent();
        }

        $customFieldDefinition->delete();

        return response()->noContent();
    }
}
