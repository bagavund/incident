<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Дежурный на инциденте — теперь реальный аккаунт, а не свободный текст:
     * право редактировать/удалять инцидент проверяется сравнением по этому id
     * (см. IncidentPolicy), а строка легко подделывалась бы или не совпадала
     * из-за опечатки/однофамильцев.
     */
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->dropColumn('on_duty_name');
            $table->foreignId('on_duty_user_id')->nullable()->after('criticality')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->dropColumn('on_duty_user_id');
            $table->string('on_duty_name')->nullable();
        });
    }
};
