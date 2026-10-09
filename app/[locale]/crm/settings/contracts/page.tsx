import PageHeader from "@/components/crm/shared/PageHeader";
import SettingsTabs from "@/components/crm/Settings/SettingsTabs";
import ContractTemplatesManager from "@/components/crm/Finance/ContractTemplatesManager";

// Настройки → Договора: шаблоны договоров (аренда, найм, подряд…). Здесь формируются все шаблоны,
// которые затем выбираются при выписке договора клиенту в разделе Бухгалтерия → Договора.
export default function SettingsContractsPage() {
    return (
        <div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
            <PageHeader />
            <div className="flex flex-col gap-20 lg:flex-row">
                <SettingsTabs className="shrink-0 md:self-start" />
                <div className="min-w-0 flex-1">
                    <ContractTemplatesManager />
                </div>
            </div>
        </div>
    );
}
