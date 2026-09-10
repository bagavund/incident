<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Черновик инцидента заводится по одному названию — тип и критичность
 * проставляются позже, при доведении до публикации. Поэтому колонки
 * больше не NOT NULL (started_at/detected_at/on_duty_user_id уже nullable).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->string('type')->nullable()->change();
            $table->string('criticality')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->string('type')->nullable(false)->change();
            $table->string('criticality')->nullable(false)->change();
        });
    }
};
