<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * До исправления IncidentAuditor сравнивал значения полей как строки, а
 * снимок «до» держит сырые значения из БД, состояние «после» — приведённые
 * кастами. Одни и те же данные выглядели по-разному:
 *  - JSON-поля (zones, impact_targets): MySQL хранит с пробелом после запятой
 *    ('["site", "app"]'), энкодер Laravel — без ('["site","app"]');
 *  - boolean (stub_installed): из БД приходит 0/1, каст даёт false/true.
 * В итоге в журнал на каждое сохранение падала ложная запись «поле: X → X».
 *
 * Миграция вычищает из накопленных записей все пары, где старое и новое
 * значения по сути совпадают, а записи, оставшиеся без единого реального
 * изменения, удаляет — так же, как контроллер теперь не пишет пустой diff.
 */
return new class extends Migration
{
    public function up(): void
    {
        $canonical = static function (mixed $value): string {
            if (is_string($value)) {
                $decoded = json_decode($value, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    return json_encode($decoded);
                }
            }
            if (is_array($value)) {
                return json_encode($value);
            }
            if (is_bool($value)) {
                return $value ? '1' : '0';
            }
            if ($value === null) {
                return 'null';
            }

            return (string) $value;
        };

        DB::table('incident_audits')
            ->where('action', 'updated')
            ->whereNotNull('changes')
            ->orderBy('id')
            ->each(function (object $row) use ($canonical): void {
                $changes = json_decode($row->changes, true);
                if (! is_array($changes)) {
                    return;
                }

                $kept = [];
                foreach ($changes as $field => $pair) {
                    $isPhantom = is_array($pair)
                        && array_key_exists(0, $pair)
                        && array_key_exists(1, $pair)
                        && $canonical($pair[0]) === $canonical($pair[1]);

                    if (! $isPhantom) {
                        $kept[$field] = $pair;
                    }
                }

                if ($kept === $changes) {
                    return;
                }

                if ($kept === []) {
                    DB::table('incident_audits')->where('id', $row->id)->delete();

                    return;
                }

                DB::table('incident_audits')
                    ->where('id', $row->id)
                    ->update(['changes' => json_encode($kept)]);
            });
    }

    public function down(): void
    {
        // Необратимо: удалённые ложные записи не восстанавливаются (да и незачем).
    }
};
