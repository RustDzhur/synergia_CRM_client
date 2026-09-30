"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";
import Modal from "../../shared/Modal";
import FormField from "../../shared/FormField";

// Создание отправления Укрпошты по заказу (ecom): адрес отправки из договора фирмы и отделение
// получателя из справочника. Штрихкод назначает сама Укрпошта — он сохраняется в заказе, и по нему
// печатается форма 100×100. Требуется договор: без него справочники пусты, и кнопка не открывается.

interface PostOffice { id: string; name: string; postcode?: string; city?: string }
interface UaState { connected: boolean; counterparty: { uuid: string; name: string } | null; addresses: Array<{ id: string; name: string; postcode?: string }> }

export default function UkrposhtaDialog({ orderId, onClose, onDone }: { orderId: string; onClose: () => void; onDone: () => void }) {
	const t = useTranslations("finance");
	const [state, setState] = useState<UaState | null>(null);
	const [error, setError] = useState("");
	const [senderUuid, setSenderUuid] = useState("");
	const [officeQuery, setOfficeQuery] = useState("");
	const [offices, setOffices] = useState<PostOffice[] | null>(null);
	const [office, setOffice] = useState<PostOffice | null>(null);
	const [weight, setWeight] = useState("1");
	const [cod, setCod] = useState("0");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		void apiCall<UaState>("/api/ukrposhta").then((res) => {
			if (res.ok && res.data) {
				setState(res.data);
				setSenderUuid(res.data.addresses[0]?.id ?? "");
				if (!res.data.addresses.length) setError(t("upNoContract"));
			} else setError(res.message || t("upNoContract"));
		});
	}, [t]);

	useEffect(() => {
		if (officeQuery.trim().length < 2) { setOffices(null); return; }
		let alive = true;
		const timer = window.setTimeout(async () => {
			const res = await apiCall<{ offices: PostOffice[] }>(`/api/ukrposhta?offices=${encodeURIComponent(officeQuery.trim())}`);
			if (alive) setOffices(res.ok ? res.data?.offices ?? [] : []);
		}, 350);
		return () => { alive = false; window.clearTimeout(timer); };
	}, [officeQuery]);

	async function submit() {
		if (!office) return void toast.error(t("upPickOffice"));
		setBusy(true);
		const res = await apiCall(`/api/orders/${orderId}/ukrposhta`, "POST", {
			action: "shipment",
			senderUuid,
			postOfficeId: office.id,
			postOfficeName: office.name,
			weight: Number(weight) || 1,
			cod: Number(cod) || 0,
		});
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("upCreated"));
		onDone();
	}

	return (
		<Modal open onClose={onClose} label={t("upCreate")} className="w-full max-w-[520px]">
			<div className="fs-popover flex max-h-[calc(100dvh-32px)] flex-col gap-12 p-20">
				<h2 className="text-15 font-semibold text-[#f1f4ee]">{t("upCreate")}</h2>
				{error && <p className="rounded-10 bg-[rgba(244,161,0,0.10)] p-12 text-12 text-[#F4A100]">{error}</p>}
				{state && !error && (
					<>
						<label className="block">
							<span className="mb-6 block text-12 text-[#8c948b]">{t("upSenderAddress")}</span>
							<select value={senderUuid} onChange={(e) => setSenderUuid(e.target.value)} className="fs-field h-40 w-full px-12 text-13 outline-none">
								{state.addresses.map((a) => <option key={a.id} value={a.id}>{a.name}{a.postcode ? ` · ${a.postcode}` : ""}</option>)}
							</select>
						</label>
						<label className="block">
							<span className="mb-6 block text-12 text-[#8c948b]">{t("upPostOffice")}</span>
							<input value={office ? `${office.name}${office.postcode ? ` · ${office.postcode}` : ""}` : officeQuery} onChange={(e) => { setOffice(null); setOfficeQuery(e.target.value); }} placeholder={t("upSearchOffice")} className="fs-field h-40 w-full px-12 text-13 outline-none" />
						</label>
						{!office && offices && (
							<ul className="max-h-[180px] overflow-y-auto rounded-10 border border-inkLineSoft">
								{offices.length === 0 ? (
									<li className="px-12 py-10 text-13 text-[#8c948b]">{t("upNoOffices")}</li>
								) : offices.map((p) => (
									<li key={p.id}>
										<button type="button" onClick={() => setOffice(p)} className="w-full px-12 py-9 text-left text-13 text-[#f1f4ee] transition-colors hover:bg-[rgba(255,255,255,0.04)]">
											{p.name}{p.postcode ? <span className="text-[#8c948b]"> · {p.postcode}</span> : null}
										</button>
									</li>
								))}
							</ul>
						)}
						<div className="grid grid-cols-2 gap-12">
							<FormField label={t("npWeight")} value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ""))} maxLength={6} />
							<FormField label={t("npCod")} value={cod} onChange={(e) => setCod(e.target.value.replace(/[^\d]/g, ""))} maxLength={10} />
						</div>
						<p className="text-11 text-[#9AA396]">{t("upEcomHint")}</p>
					</>
				)}
				<div className="mt-4 flex justify-end gap-10">
					<button type="button" onClick={onClose} className="fs-btn fs-btn-ghost h-38">{t("cancel")}</button>
					<button type="button" disabled={busy || !office || !senderUuid || !!error} onClick={submit} className="fs-btn fs-btn-primary h-38 disabled:opacity-50">
						{t("upCreate")}
					</button>
				</div>
			</div>
		</Modal>
	);
}
