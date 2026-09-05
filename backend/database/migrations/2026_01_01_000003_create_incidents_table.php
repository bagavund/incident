<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('incidents', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('title');

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->string('type');        // свободный текст, значения из справочника incident_types
            $table->string('criticality'); // свободный текст, значения из справочника criticalities
            $table->string('status')->default('draft'); // App\Enums\IncidentStatus
            $table->string('sla')->default('met');       // App\Enums\IncidentSla

            $table->string('on_duty_name')->nullable();

            $table->timestamp('started_at')->nullable();
            $table->timestamp('detected_at')->nullable();
            $table->timestamp('resolved_at')->nullable();

            $table->boolean('stub_installed')->default(false);
            $table->string('stub_on')->nullable();  // "HH:MM"
            $table->string('stub_off')->nullable(); // "HH:MM"

            $table->text('cause')->nullable();
            $table->text('impact')->nullable();
            $table->string('task_link')->nullable();
            $table->json('zones')->nullable();

            $table->timestamps();

            $table->index(['status', 'type', 'sla']);
            $table->index('detected_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incidents');
    }
};
