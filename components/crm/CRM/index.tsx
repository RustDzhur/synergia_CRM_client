"use client";
import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DealsBoard from "./DealsBoard";
import Contacts from "../Contacts";
import Companies from "../Companies";
import SearchBox from "../shared/SearchBox";
import PageHeader from "@/components/crm/shared/PageHeader";
import { TAB_BAR, TAB_ITEM, TAB_ITEM_ACTIVE, TAB_ITEM_IDLE } from "../shared/tabBar";

type Tab = "deals" | "contacts" | "companies";
const TABS: Tab[] = ["deals", "contacts", "companies"];

function CrmContent() {
    const t = useTranslations("crm");
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const [search, setSearch] = useState("");

    // активная вкладка хранится в адресе (?tab=contacts): так после «Back» со страницы редактирования
    // открывается та же вкладка, а ссылку можно скопировать
    const tab: Tab = TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "deals";
    const selectTab = (next: Tab) => {
        setSearch("");
        router.replace(next === "deals" ? pathname : `${pathname}?tab=${next}`, { scroll: false });
    };

    return (
        <div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
            <PageHeader>
                {/* Вкладки разделов и поиск — одной строкой под заголовком */}
                <div className="flex flex-col gap-16 md:flex-row md:items-center md:justify-between">
                    <div className={TAB_BAR}>
                        {TABS.map((key) => (
                            <button
                                key={key}
                                className={`${TAB_ITEM} capitalize ${tab === key ? TAB_ITEM_ACTIVE : TAB_ITEM_IDLE}`}
                                onClick={() => selectTab(key)}
                            >
                                {t(key)}
                            </button>
                        ))}
                    </div>
                    <SearchBox value={search} onChange={setSearch} placeholder={t("search")} className="w-full shrink-0 md:w-[300px]" />
                </div>
            </PageHeader>

            {tab === "deals" && <DealsBoard search={search} />}
            {tab === "contacts" && <Contacts search={search} />}
            {tab === "companies" && <Companies search={search} />}
        </div>
    );
}

// useSearchParams требует Suspense-границы (иначе сборка страницы падает)
export default function Crm() {
    return (
        <Suspense fallback={null}>
            <CrmContent />
        </Suspense>
    );
}
