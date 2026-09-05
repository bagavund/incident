<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('escalation_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('incident_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position')->default(0);
            $table->string('time')->nullable(); // "HH:MM"
            $table->string('callee_name')->nullable();
            $table->string('kind');    // App\Enums\EscalationKind
            $table->string('channel'); // App\Enums\EscalationChannel
            $table->string('result');  // App\Enums\EscalationResult
            $table->unsignedSmallInteger('attempts')->default(1);
            $table->timestamps();

            $table->index(['incident_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('escalation_attempts');
    }
};
