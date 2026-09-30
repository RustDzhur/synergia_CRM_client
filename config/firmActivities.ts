// Виды деятельности фирмы (ТЗ §18): мастер «Чем занимается фирма?» отмечает их, и финансовый раздел
// показывает только нужные вкладки. Живёт отдельным модулем: файлы маршрутов не могут экспортировать
// ничего, кроме обработчиков (иначе ломается проверка типов при сборке Next).
export const ACTIVITIES = ["services", "retail", "wholesale", "production", "importExport"] as const;
export type FirmActivity = (typeof ACTIVITIES)[number];
