"use client";
import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MdSearch, MdTune } from "react-icons/md";
import DealsBoard from "./DealsBoard";
import Contacts from "../Contacts";
import Companies from "../Companies";

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
        <div className="p-16 md:p-30">
            {/* Head Row: вкладки + поиск, одной строкой, как в макете */}
            <div className="mb-20 flex flex-wrap items-center justify-between gap-16">
                <div className="flex items-center rounded-8 bg-[#F2F2F2] p-10 shadow-custom">
                    {TABS.map((key) => (
                        <button
                            key={key}
                            className={`rounded-4 px-16 py-10 text-16 font-medium capitalize tracking-[0.32px] transition-colors duration-200 ${
                                tab === key ? "bg-primaryColor text-white" : "text-[#CCCCCC] hover:text-[#999999]"
                            }`}
                            onClick={() => selectTab(key)}
                        >
                            {t(key)}
                        </button>
                    ))}
                </div>

                <div className="flex h-[50px] w-full items-center justify-between rounded-8 border-2 border-[#E6E6E6] bg-white px-20 shadow-custom transition-colors focus-within:border-[#5EA8F5] md:w-[350px]">
                    <input
                        className="w-full text-18 tracking-[0.36px] outline-none placeholder:text-[#CCCCCC]"
                        placeholder={t("search")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <div className="flex shrink-0 items-center gap-12 text-[#CCCCCC]">
                        <MdSearch size={20} />
                        <MdTune size={20} />
                    </div>
                </div>
            </div>

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
