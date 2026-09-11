<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>{{ $incident->code }}</title>
<style>
    /* dompdf: CSS2.1 + часть CSS3, без flexbox/grid — вёрстка на таблицах,
       block/inline-block и border-left вместо псевдоэлементов для линии
       хронологии. DejaVu Sans — единственный шрифт из коробки со всей
       кириллицей, менять на Helvetica/Arial нельзя (в base14 её нет). */
    @page { margin: 28px 34px; }
    body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #20221f; line-height: 1.5; }

    .brand-mark { display: inline-block; width: 15px; height: 15px; background: #184936; border-radius: 4px; vertical-align: -3px; }
    .brand-text { font-size: 13px; font-weight: bold; margin-left: 2px; }
    .brand-sub { font-size: 8.5px; color: #8b9089; margin-top: 2px; }
    .meta { text-align: right; font-size: 9px; color: #5b6058; line-height: 1.6; }

    .rule { border-top: 2px solid #20221f; margin: 12px 0 16px; }

    .code { font-size: 10px; font-weight: bold; color: #184936; letter-spacing: 0.6px; }
    .title { font-size: 19px; font-weight: bold; margin: 6px 0 10px; }

    .tag { display: inline-block; font-size: 8.5px; font-weight: bold; padding: 4px 10px; border-radius: 9px; margin: 0 5px 5px 0; }
    .tag-crit { background: #fbeeec; color: #b23b32; }
    .tag-neutral { background: #f0f1ee; color: #5b6058; }
    .tag-good { background: #eaf3ee; color: #1f7a4d; }

    table.kpi { width: 100%; border-collapse: collapse; margin: 16px 0 20px; border: 1px solid #dfe2dd; border-radius: 6px; }
    table.kpi td { width: 25%; padding: 10px 14px; border-left: 1px solid #dfe2dd; }
    table.kpi td:first-child { border-left: none; }
    .kpi-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.4px; color: #8b9089; }
    .kpi-value { font-size: 17px; font-weight: bold; margin-top: 4px; }
    .kpi-value.crit { color: #b23b32; }

    table.fields { width: 100%; border-collapse: collapse; margin: 0 0 20px; }
    table.fields td { padding: 8px 0; border-bottom: 1px solid #ebede9; font-size: 10.5px; }
    table.fields tr:first-child td { padding-top: 0; }
    table.fields td.label { color: #5b6058; width: 32%; }
    table.fields td.value { font-weight: bold; text-align: right; }

    .section-title { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #184936; letter-spacing: 0.6px; margin: 18px 0 10px; padding-bottom: 5px; border-bottom: 1px solid #dfe2dd; }

    /* Хронология: сплошная линия — border-left самого блока; кружки поверх
       неё позиционируются абсолютно, что dompdf рендерит надёжно. */
    .timeline { position: relative; margin-left: 4px; padding-left: 16px; border-left: 1.5px solid #d3d7d0; }
    .tl-row { position: relative; margin-bottom: 11px; }
    .tl-row:last-child { margin-bottom: 0; }
    .tl-dot { position: absolute; left: -20.5px; top: 3px; width: 7px; height: 7px; border-radius: 4px; background: #184936; }
    .tl-time { display: inline-block; width: 42px; font-weight: bold; color: #5b6058; font-size: 10px; }
    .tl-kind { font-weight: bold; font-size: 10.5px; }
    .tl-detail { color: #5b6058; font-size: 10.5px; }

    table.esc { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 2px; }
    table.esc th { text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: 0.4px; color: #8b9089; padding: 0 8px 6px 0; border-bottom: 1px solid #d3d7d0; }
    table.esc td { padding: 7px 8px 7px 0; border-bottom: 1px solid #ebede9; }
    .pill { display: inline-block; font-size: 8.5px; font-weight: bold; padding: 3px 8px; border-radius: 9px; }
    .pill-ok { background: #eaf3ee; color: #1f7a4d; }
    .pill-fail { background: #fbeeec; color: #b23b32; }

    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ebede9; font-size: 8px; color: #8b9089; }
</style>
</head>
<body>

    <table style="width:100%; border-collapse: collapse;">
        <tr>
            <td>
                <span class="brand-mark"></span><span class="brand-text">IMS</span><br>
                <span class="brand-sub">Incident Management System</span>
            </td>
            <td class="meta">
                Сформирован {{ $generatedAt }}<br>
                @if($incident->onDuty) Дежурный: {{ $incident->onDuty->name }} @endif
            </td>
        </tr>
    </table>

    <div class="rule"></div>

    <div class="code">{{ $incident->code }}</div>
    <div class="title">{{ $incident->title }}</div>
    <div>
        @if($incident->criticality)
            <span class="tag tag-crit">Критичность: {{ $incident->criticality }}</span>
        @endif
        @if($incident->zones && count($incident->zones))
            <span class="tag tag-neutral">Зоны: {{ implode(', ', $incident->zones) }}</span>
        @endif
        <span class="tag {{ $incident->sla?->value === 'breached' ? 'tag-crit' : 'tag-good' }}">
            SLA {{ $incident->sla?->label() ?? '—' }}
        </span>
    </div>

    <table class="kpi">
        <tr>
            <td>
                <div class="kpi-label">До обнаружения</div>
                <div class="kpi-value">{{ $metrics['to_detect']['human'] ?? '—' }}</div>
            </td>
            <td>
                <div class="kpi-label">До эскалации</div>
                <div class="kpi-value {{ ($metrics['to_escalate']['minutes'] ?? 0) > 30 ? 'crit' : '' }}">
                    {{ $metrics['to_escalate']['human'] ?? '—' }}
                </div>
            </td>
            <td>
                <div class="kpi-label">Диагностика</div>
                <div class="kpi-value">{{ $metrics['to_diagnose']['human'] ?? '—' }}</div>
            </td>
            <td>
                <div class="kpi-label">До решения</div>
                <div class="kpi-value">{{ $metrics['to_resolve']['human'] ?? '—' }}</div>
            </td>
        </tr>
    </table>

    <table class="fields">
        <tr>
            <td class="label">Начало</td>
            <td class="value">{{ $fmt($incident->started_at) }}</td>
        </tr>
        <tr>
            <td class="label">Решено</td>
            <td class="value">{{ $fmt($incident->resolved_at) }}</td>
        </tr>
        <tr>
            <td class="label">Сервисы</td>
            <td class="value">{{ $incident->services->pluck('name')->implode(', ') ?: '—' }}</td>
        </tr>
        @if($incident->stub_installed)
        <tr>
            <td class="label">Заглушка</td>
            <td class="value">
                {{ $incident->stub_on ?? '—' }}–{{ $incident->stub_off ?? '—' }}
                @if($metrics['stub_duration']['human']) ({{ $metrics['stub_duration']['human'] }}) @endif
            </td>
        </tr>
        @endif
        <tr>
            <td class="label">Причина</td>
            <td class="value">{{ $incident->cause ?: '—' }}</td>
        </tr>
        <tr>
            <td class="label">Влияние</td>
            <td class="value">{{ $incident->impact ?: '—' }}</td>
        </tr>
        @if($incident->task_link)
        <tr>
            <td class="label">Задача</td>
            <td class="value">{{ $incident->task_link }}</td>
        </tr>
        @endif
    </table>

    <div class="section-title">Хронология</div>
    <div class="timeline">
        <div class="tl-row">
            <span class="tl-dot"></span>
            <span class="tl-time">{{ $incident->started_at?->format('H:i') ?? '—' }}</span>
            <span class="tl-kind">Начало инцидента</span>
        </div>
        @foreach($incident->timelineSteps as $step)
        <div class="tl-row">
            <span class="tl-dot"></span>
            <span class="tl-time">{{ $step->occurred_at?->format('H:i') ?? '—' }}</span>
            <span class="tl-kind">{{ $step->kind->label() }}</span>
            @if($step->action)
                <span class="tl-detail">— {{ $step->action }}</span>
            @endif
        </div>
        @endforeach
    </div>

    @if($incident->escalationAttempts->count())
    <div class="section-title">Эскалации</div>
    <table class="esc">
        <thead>
            <tr>
                <th>Время</th>
                <th>Кому</th>
                <th>Канал</th>
                <th>Попыток</th>
                <th>Результат</th>
            </tr>
        </thead>
        <tbody>
            @foreach($incident->escalationAttempts as $attempt)
            <tr>
                <td>{{ $attempt->time ?? '—' }}</td>
                <td>{{ $attempt->callee_name ?: '—' }}</td>
                <td>{{ $attempt->channel?->label() ?? '—' }}</td>
                <td>{{ $attempt->attempts }}</td>
                <td>
                    <span class="pill {{ $attempt->result?->value === 'reached' ? 'pill-ok' : 'pill-fail' }}">
                        {{ $attempt->result?->label() ?? '—' }}
                    </span>
                </td>
            </tr>
            @endforeach
        </tbody>
    </table>
    @endif

    <div class="footer">
        Отчёт сформирован автоматически системой IMS по данным карточки инцидента {{ $incident->code }}.
    </div>

</body>
</html>
