<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Кто и когда правил инцидент — обязательная вещь для системы разбора
     * инцидентов: постмортем меняют "задним числом", и без журнала невозможно
     * понять, кто подвинул тайминги или сменил вердикт по SLA.
     *
     * incident_code/title дублируются на запись: удаление инцидента не должно
     * стирать саму запись о том, что (и кем) он был удалён, поэтому incident_id
     * не каскадится, а без снимка кода/названия такая запись ничего не значит.
     */
    public function up(): void
    {
        Schema::create('incident_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('incident_id')->nullable()->constrained()->nullOnDelete();
            $table->string('incident_code');
            $table->string('incident_title');
            // nullable: пользователь мог быть удалён, запись изменения — нет.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action'); // created | updated | deleted
            // {field: [old, new]} по изменённым верхнеуровневым атрибутам инцидента.
            $table->json('changes')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incident_audits');
    }
};
