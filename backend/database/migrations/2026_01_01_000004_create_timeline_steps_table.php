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
            // Момент шага: время суток из формы ("HH:MM") сервер привязывает
            // к календарному дню начала инцидента (TimelineSync), с переносом
            // на следующие сутки, если время шага ушло назад относительно
            // предыдущего.
            $table->timestamp('occurred_at')->nullable();
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
