"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useContactStore, Contact } from "@/app/store/useContactStore";

export default function Contacts() {
    const t = useTranslations("contacts");
    const { contacts, isLoading, fetchContacts, addContact, updateContact, deleteContact } = useContactStore();
    const [search, setSearch] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<Partial<Contact>>({});
    const [showAddRow, setShowAddRow] = useState(false);

    useEffect(() => { fetchContacts(); }, [fetchContacts]);

    const filtered = contacts.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
    );

    function startEdit(c: Contact) {
        setEditingId(c._id);
        setForm(c);
    }

    async function saveEdit() {
        if (!editingId) return;
        await updateContact(editingId, form);
        setEditingId(null);
        setForm({});
    }

    async function saveNew() {
        if (!form.name) return;
        await addContact(form);
        setForm({});
        setShowAddRow(false);
    }

    async function handleDelete(id: string) {
        if (confirm(t("confirmDelete"))) await deleteContact(id);
    }

    return (
        <div className="p-30">
            <div className="flex items-center justify-between mb-20">
                <h1 className="text-24 font-bold">{t("title")}</h1>
                <button
                    className="bg-primaryColor text-white px-20 py-10 rounded-8"
                    onClick={() => setShowAddRow(true)}
                >
                    {t("add")}
                </button>
            </div>

            <input
                className="border border-switchCompany rounded-8 px-14 py-10 mb-20 w-full max-w-[320px]"
                placeholder={t("search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />

            {isLoading ? (
                <p>Loading…</p>
            ) : (
                <table className="w-full text-left border-collapse">
                    <thead>
                    <tr className="text-14 text-menu border-b-switchCompany">
                        <th className="py-10">{t("name")}</th>
                        <th className="py-10">{t("email")}</th>
                        <th className="py-10">{t("phone")}</th>
                        <th className="py-10">{t("company")}</th>
                        <th className="py-10">{t("position")}</th>
                        <th className="py-10"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {showAddRow && (
                        <tr className="border-b-switchCompany">
                            <td><input className="border rounded-6 px-8 py-6 w-full" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></td>
                            <td><input className="border rounded-6 px-8 py-6 w-full" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></td>
                            <td><input className="border rounded-6 px-8 py-6 w-full" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></td>
                            <td><input className="border rounded-6 px-8 py-6 w-full" value={form.company || ""} onChange={(e) => setForm({ ...form, company: e.target.value })} /></td>
                            <td><input className="border rounded-6 px-8 py-6 w-full" value={form.position || ""} onChange={(e) => setForm({ ...form, position: e.target.value })} /></td>
                            <td className="flex gap-8">
                                <button className="text-primaryColor text-14" onClick={saveNew}>{t("save")}</button>
                                <button className="text-menu text-14" onClick={() => { setShowAddRow(false); setForm({}); }}>{t("cancel")}</button>
                            </td>
                        </tr>
                    )}

                    {filtered.map((c) =>
                        editingId === c._id ? (
                            <tr key={c._id} className="border-b-switchCompany">
                                <td><input className="border rounded-6 px-8 py-6 w-full" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></td>
                                <td><input className="border rounded-6 px-8 py-6 w-full" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></td>
                                <td><input className="border rounded-6 px-8 py-6 w-full" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></td>
                                <td><input className="border rounded-6 px-8 py-6 w-full" value={form.company || ""} onChange={(e) => setForm({ ...form, company: e.target.value })} /></td>
                                <td><input className="border rounded-6 px-8 py-6 w-full" value={form.position || ""} onChange={(e) => setForm({ ...form, position: e.target.value })} /></td>
                                <td className="flex gap-8">
                                    <button className="text-primaryColor text-14" onClick={saveEdit}>{t("save")}</button>
                                    <button className="text-menu text-14" onClick={() => setEditingId(null)}>{t("cancel")}</button>
                                </td>
                            </tr>
                        ) : (
                            <tr key={c._id} className="border-b-switchCompany">
                                <td className="py-10">{c.name}</td>
                                <td className="py-10">{c.email}</td>
                                <td className="py-10">{c.phone}</td>
                                <td className="py-10">{c.company}</td>
                                <td className="py-10">{c.position}</td>
                                <td className="py-10 flex gap-14">
                                    <button className="text-primaryColor text-14" onClick={() => startEdit(c)}>{t("edit")}</button>
                                    <button className="text-red text-14" onClick={() => handleDelete(c._id)}>{t("delete")}</button>
                                </td>
                            </tr>
                        )
                    )}
                    </tbody>
                </table>
            )}
        </div>
    );
}