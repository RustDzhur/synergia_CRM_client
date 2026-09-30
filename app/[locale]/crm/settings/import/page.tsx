import ImportWizard from "@/components/crm/Settings/ImportWizard";

// Настройки → Импорт: мастер импорта/экспорта (ТЗ §17). Страница не под тарифным гейтом:
// перенести свои данные из другой CRM должен мочь любой тариф.
export default function ImportPage() {
    return <ImportWizard />;
}
