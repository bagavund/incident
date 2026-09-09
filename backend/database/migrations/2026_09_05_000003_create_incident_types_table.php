<?php

use App\Enums\ProblemCategory;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('incident_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('category')->default(ProblemCategory::Internal->value);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incident_types');
    }
};
