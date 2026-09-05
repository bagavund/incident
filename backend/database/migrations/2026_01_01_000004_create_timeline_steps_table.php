<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('timeline_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('incident_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position')->default(0);
            $table->string('kind'); // App\Enums\TimelineKind
            $table->text('action')->nullable();
            $table->string('time')->nullable(); // "HH:MM"
            $table->boolean('custom')->default(false); // промежуточный шаг без фиксированного kind-слота
            $table->timestamps();

            $table->index(['incident_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timeline_steps');
    }
};
