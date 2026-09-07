<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Единственная строка настроек SLA. Раньше порог был привязан к
     * критичности; теперь SLA — это одно общее время на эскалацию
     * (обнаружение → передача ответственным), которое администратор
     * настраивает в одном месте.
     */
    public function up(): void
    {
        Schema::create('sla_settings', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('escalation_minutes')->default(30);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sla_settings');
    }
};
