"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useEmployeeStore } from "@/app/store/useEmployeeStore";

export default function Company() {
    const { items, total, isLoading, query, setQuery, fetchEmployees } = useEmployeeStore();
    const t = useTranslations("company");

    useEffect(() => { fetchEmployees(1); }, [fetchEmployees]);

    return (
        <div className="p-30">
            <div className="flex items-center justify-between mb-20">
                <h1 className="text-24 font-bold">{t("employees")}</h1>
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchEmployees(1)}
                    placeholder={t("search")}
                    className="border rounded-8 px-20 py-14"
                />
            </div>
            {isLoading ? (
                <p>Loading…</p>
            ) : (
                <table className="w-full text-left">
                    <thead>
                    <tr className="text-menu text-14">
                        <th className="py-15">{t("photo")}</th>
                        <th>{t("name")}</th>
                        <th>{t("email")}</th>
                        <th>{t("workPhone")}</th>
                        <th>{t("position")}</th>
                        <th>{t("department")}</th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.map((e) => (
                        <tr key={e._id} className="border-t-switchCompany">
                            <td className="py-10"><div className="w-50 h-50 rounded-full bg-gray" /></td>
                            <td>{e.firstname} {e.lastname}</td>
                            <td>{e.email}</td>
                            <td>{e.workPhone}</td>
                            <td>{e.position}</td>
                            <td>{e.department}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}
            <p className="mt-20 text-14 text-menu">Total: {total}</p>
        </div>
    );
}