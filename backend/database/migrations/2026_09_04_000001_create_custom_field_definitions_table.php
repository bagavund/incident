<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('custom_field_definitions', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique(); // machine key, e.g. "root_cause_team"
            $table->string('label');
            $table->string('type'); // App\Enums\CustomFieldType
            $table->json('options')->nullable(); // список опций для type=select
            $table->boolean('required')->default(false);
            $table->boolean('active')->default(true); // архивные поля скрыты из формы, но не удалены
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('custom_field_definitions');
    }
};
