<?php

namespace Database\Seeders;

use App\Enums\IncidentSla;
use App\Enums\IncidentStatus;
use App\Enums\TimelineKind;
use App\Models\Incident;
use App\Models\Service;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

class IncidentSeeder extends Seeder
{
    private const TYPE_OUR_SIDE = 'Проблема на нашей стороне';

    private const TYPE_EXTERNAL = 'Внешняя проблема';

    private const TYPE_SERVICE_PROBLEM = 'Сервис с проблемой';

    private const TYPE_STUB = 'Установлена заглушка';

    private const ZONES = [
        'API Gateway' => ['Backend', 'Инфраструктура / DevOps'],
        'Мобильное приложение' => ['Frontend', 'Backend'],
        'Авторизация' => ['Backend', 'Внешний провайдер'],
        'Платёжный сервис' => ['Backend', 'База данных'],
        'Личный кабинет' => ['Frontend'],
        'Уведомления' => ['Backend', 'Внешний провайдер'],
        'Данные' => ['База данных', 'Backend'],
    ];

    private const CAUSES = [
        'Исчерпание пула соединений с БД после релиза',
        'Некорректная конфигурация балансировщика',
        'Деградация внешнего провайдера аутентификации',
        'Утечка памяти в обработчике очереди',
        'Просроченный TLS-сертификат интеграции',
        'Блокировки в БД из-за тяжёлого отчётного запроса',
    ];

    private const IMPACTS = [
        'Часть пользователей получала ошибки при основных операциях, конверсия временно просела.',
        'Замедление ответа сервиса, рост числа обращений в поддержку.',
        'Полная недоступность функции на время инцидента для всех клиентов.',
        'Фоновые задачи выполнялись с задержкой, данные обновлялись с опозданием.',
    ];

    private const ON_DUTY = ['Иванов Иван', 'Петрова Анна', 'Сидоров Пётр', 'Кузнецова Мария'];

    private const CRITICALITIES = ['Критичный', 'Важный', 'Второстепенный'];

    /** @var list<array{0:string,1:string,2:string,3:bool,4:string}> title, service, type, resolved, detected_at */
    private const TEMPLATES = [
        ['Ошибка 500 при создании заказа', 'Платёжный сервис', self::TYPE_OUR_SIDE, true, '2026-06-30 14:32'],
        ['Недоступность мобильного приложения', 'Мобильное приложение', self::TYPE_SERVICE_PROBLEM, false, '2026-06-30 11:15'],
        ['Медленная загрузка личного кабинета', 'Личный кабинет', self::TYPE_OUR_SIDE, true, '2026-06-29 21:45'],
        ['Проблемы с авторизацией', 'Авторизация', self::TYPE_EXTERNAL, false, '2026-06-29 19:10'],
        ['Сбой API Gateway', 'API Gateway', self::TYPE_OUR_SIDE, true, '2026-06-29 16:05'],
        ['Ошибки при оплате', 'Платёжный сервис', self::TYPE_SERVICE_PROBLEM, true, '2026-06-28 13:22'],
        ['Долгое обновление данных', 'Данные', self::TYPE_OUR_SIDE, true, '2026-06-27 09:40'],
        ['Сбой отправки email', 'Уведомления', self::TYPE_EXTERNAL, true, '2026-06-26 17:55'],
        ['Таймауты в поиске', 'API Gateway', self::TYPE_OUR_SIDE, true, '2026-06-25 12:03'],
        ['Некорректный баланс бонусов', 'Личный кабинет', self::TYPE_OUR_SIDE, true, '2026-06-24 10:18'],
        ['Задержка push-уведомлений', 'Уведомления', self::TYPE_STUB, false, '2026-06-23 08:47'],
        ['Ошибка выгрузки отчётов', 'Данные', self::TYPE_OUR_SIDE, false, '2026-06-22 15:29'],
        ['5xx на оформлении подписки', 'Платёжный сервис', self::TYPE_OUR_SIDE, true, '2026-06-20 10:11'],
        ['Отвал вебхуков платёжного провайдера', 'Платёжный сервис', self::TYPE_EXTERNAL, true, '2026-06-18 08:24'],
        ['Долгий логин через соцсети', 'Авторизация', self::TYPE_EXTERNAL, true, '2026-06-16 14:47'],
        ['Рост латентности API Gateway', 'API Gateway', self::TYPE_OUR_SIDE, true, '2026-06-14 19:33'],
        ['Не приходят SMS-коды', 'Уведомления', self::TYPE_SERVICE_PROBLEM, true, '2026-06-12 11:02'],
        ['Ошибки синхронизации каталога', 'Данные', self::TYPE_OUR_SIDE, true, '2026-06-10 09:15'],
        ['Падение мобильного при открытии заказа', 'Мобильное приложение', self::TYPE_OUR_SIDE, true, '2026-06-08 16:41'],
        ['Заглушка на разделе бонусов', 'Личный кабинет', self::TYPE_STUB, true, '2026-06-05 12:20'],
        ['Тайм-ауты БД в часы пик', 'Данные', self::TYPE_OUR_SIDE, true, '2026-06-03 20:05'],
        ['Ошибки 502 на статике', 'API Gateway', self::TYPE_EXTERNAL, true, '2026-06-01 07:58'],
        ['Двойное списание при оплате', 'Платёжный сервис', self::TYPE_OUR_SIDE, true, '2026-05-29 13:37'],
        ['Сброс сессий пользователей', 'Авторизация', self::TYPE_OUR_SIDE, true, '2026-05-27 10:49'],
        ['Деградация уведомлений в приложении', 'Уведомления', self::TYPE_EXTERNAL, true, '2026-05-24 18:12'],
        ['Долгая выгрузка аналитики', 'Данные', self::TYPE_OUR_SIDE, true, '2026-05-21 15:06'],
    ];

    public function run(): void
    {
        $engineer = User::where('email', 'engineer@ims.local')->first();
        $services = Service::pluck('id', 'name');

        // Шаблоны датированы «2026-06-...»; переносим их так, чтобы самый свежий
        // инцидент оказался сегодня, а относительные интервалы сохранились.
        $anchor = CarbonImmutable::parse('2026-06-30 14:32');
        $today = CarbonImmutable::now();

        $year = (int) $today->year;
        $seq = 14 + count(self::TEMPLATES); // самый свежий инцидент получит наибольший номер

        foreach (self::TEMPLATES as [$title, $serviceName, $type, $resolved, $detectedAt]) {
            $code = sprintf('INC-%d-%05d', $year, $seq--);
            $seed = array_sum(array_map('ord', str_split($code)));

            $orig = CarbonImmutable::parse($detectedAt);
            $daysAgo = (int) floor($orig->diffInDays($anchor));
            $detected = $today->subDays($daysAgo)->setTime($orig->hour, $orig->minute);
            $started = $detected->subMinutes(8 + $seed % 15);
            $diagnosis = $detected->addMinutes(3 + $seed % 6);
            $handoff = $diagnosis->addMinutes(18 + $seed % 42);
            $resolvedAt = $resolved ? $handoff->addMinutes(25 + $seed % 170) : null;

            $zones = self::ZONES[$serviceName] ?? ['Backend'];
            $isStub = $type === self::TYPE_STUB;

            $incident = Incident::create([
                'code' => $code,
                'title' => $title,
                'created_by' => $engineer?->id,
                'type' => $type,
                'criticality' => self::CRITICALITIES[$seed % count(self::CRITICALITIES)],
                'status' => $resolvedAt ? IncidentStatus::Published : IncidentStatus::Draft,
                'sla' => $seed % 5 === 0 ? IncidentSla::Breached : IncidentSla::Met,
                'on_duty_name' => self::ON_DUTY[$seed % count(self::ON_DUTY)],
                'started_at' => $started,
                'detected_at' => $detected,
                'resolved_at' => $resolvedAt,
                'stub_installed' => $isStub,
                'stub_on' => $isStub ? $diagnosis->format('H:i') : null,
                'stub_off' => $isStub && $resolvedAt ? $resolvedAt->format('H:i') : null,
                'cause' => self::CAUSES[$seed % count(self::CAUSES)],
                'impact' => self::IMPACTS[$seed % count(self::IMPACTS)],
                'task_link' => "https://tracker.example.com/{$code}",
                'zones' => $zones,
            ]);

            $incident->services()->attach($services[$serviceName]);

            $steps = [
                [TimelineKind::Detected, $title, $detected],
                [TimelineKind::Diagnosis, "Анализ логов и метрик сервиса «{$serviceName}»", $diagnosis],
                [TimelineKind::HandedOff, 'Эскалация ответственной команде: '.end($zones), $handoff],
            ];
            if ($resolvedAt) {
                $steps[] = [TimelineKind::Resolved, 'Инцидент устранён, сервис в норме', $resolvedAt];
            }

            foreach ($steps as $position => [$kind, $action, $at]) {
                $incident->timelineSteps()->create([
                    'position' => $position,
                    'kind' => $kind,
                    'action' => $action,
                    'time' => $at->format('H:i'),
                ]);
            }
        }
    }
}
