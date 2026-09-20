"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { BsSearch } from "react-icons/bs";
import { FiSettings } from "react-icons/fi";
import DealsBoard from "./DealsBoard";
import Contacts from "../Contacts";

export default function Crm() {
    const t = useTranslations("crm");
    const [tab, setTab] = useState<"deals" | "contacts" | "companies">("deals");
    const [search, setSearch] = useState("");

    return (
        <div className="p-30">
            {/* Head Row: вкладки + поиск, одной строкой, как в макете */}
            <div className="flex items-center justify-between flex-wrap gap-16 mb-20">
                <div className="bg-[#F2F2F2] shadow-sm rounded-8 flex items-center px-18 py-10">
                    {(["deals", "contacts", "companies"] as const).map((key) => (
                        <button
                            key={key}
                            className={`px-16 py-10 rounded-8 text-16 font-medium capitalize tracking-[0.32px] ${
                                tab === key ? "bg-primaryColor text-white" : "text-[#CCCCCC]"
                            }`}
                            onClick={() => setTab(key)}
                        >
                            {t(key)}
                        </button>
                    ))}
                </div>

                <div className="bg-white border-2 border-[#E6E6E6] shadow-sm rounded-8 flex items-center justify-between px-20 py-14 w-[350px]">
                    <input
                        className="text-18 tracking-[0.36px] placeholder:text-[#CCCCCC] outline-none w-full"
                        placeholder={t("search")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <div className="flex items-center gap-12 text-[#CCCCCC] shrink-0">
                        <BsSearch size={18} />
                        <FiSettings size={18} />
                    </div>
                </div>
            </div>

            {tab === "deals" && <DealsBoard search={search} />}
            {tab === "contacts" && <Contacts />}
            {tab === "companies" && <p className="text-menu">Companies — следующий шаг.</p>}
        </div>
    );
}