"use client";
import React, { useState } from "react";
import { useLocale } from "next-intl";
import { TbCheck, TbPencil, TbPlus, TbTrash } from "react-icons/tb";
import { useOfficeStore } from "@/store/useOfficeStore";
import Modal from "../shared/Modal";
import { trRooms } from "./roomsUi";

// Свои комнаты офиса: добавить, переименовать, удалить. Сцена перестраивается сама (scene/iso.ts: configureRooms).
export default function RoomsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const tr = trRooms(useLocale());
	const { rooms, maxRooms, addRoom, renameRoom, removeRoom } = useOfficeStore();
	const [name, setName] = useState("");
	const [edit, setEdit] = useState<{ id: string; name: string } | null>(null);
	const [busy, setBusy] = useState(false);
	const full = rooms.length >= maxRooms;

	async function add(e: React.FormEvent) {
		e.preventDefault();
		if (busy || full || name.trim().length < 2) return;
		setBusy(true);
		const ok = await addRoom(name.trim());
		setBusy(false);
		if (ok) setName("");
	}
	async function save() {
		if (!edit || busy) return;
		setBusy(true);
		const ok = await renameRoom(edit.id, edit.name);
		setBusy(false);
		if (ok) setEdit(null);
	}

	return (
		<Modal open={open} onClose={onClose} label={tr("title")} align="top" className="w-full max-w-[520px]" flushOnMobile>
			<div className="fs-popover fs-scroll max-h-[92vh] overflow-y-auto p-18 md:p-24">
				<div className="flex items-start justify-between gap-12">
					<h2 className="text-18 font-semibold text-[#f1f4ee]">{tr("title")}</h2>
					<button type="button" onClick={onClose} className="shrink-0 text-13 text-[#8c948b] hover:text-[#f1f4ee]">{tr("close")}</button>
				</div>
				<p className="mt-6 text-12 leading-[1.5] text-[#8c948b]">{tr("hint")}</p>

				<ul className="mt-14 flex flex-col gap-8">
					{rooms.length === 0 && <li className="text-12 text-[#6b736a]">{tr("none")}</li>}
					{rooms.map((r) => (
						<li key={r.id} className="fs-card flex items-center gap-8 p-10">
							{edit?.id === r.id ? (
								<>
									<input className="fs-field h-36 min-w-0 flex-1 px-10 text-13 outline-none" value={edit.name} maxLength={30} autoFocus onChange={(e) => setEdit({ id: r.id, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && void save()} />
									<button type="button" onClick={() => void save()} className="fs-btn fs-btn-primary h-36 px-12" aria-label={tr("save")} title={tr("save")}><TbCheck size={16} /></button>
								</>
							) : (
								<>
									<span className="min-w-0 flex-1 truncate text-13 text-[#f1f4ee]">{r.name}</span>
									<button type="button" onClick={() => setEdit({ id: r.id, name: r.name })} className="text-[#8c948b] hover:text-[#f1f4ee]" aria-label={tr("rename")} title={tr("rename")}><TbPencil size={16} /></button>
									<button type="button" onClick={() => { if (window.confirm(tr("confirmRemove"))) void removeRoom(r.id); }} className="text-[#ff9f9f] hover:text-[#ff6f6f]" aria-label={tr("remove")} title={tr("remove")}><TbTrash size={16} /></button>
								</>
							)}
						</li>
					))}
				</ul>

				<form onSubmit={add} className="mt-14 flex gap-8">
					<input className="fs-field h-40 min-w-0 flex-1 px-12 text-13 outline-none" placeholder={tr("placeholder")} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} disabled={full} />
					<button type="submit" disabled={busy || full || name.trim().length < 2} className="fs-btn fs-btn-primary h-40 disabled:opacity-50" title={full ? tr("limit") : undefined}><TbPlus size={16} aria-hidden />{tr("add")}</button>
				</form>
			</div>
		</Modal>
	);
}
