"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";

interface Referral { id: string; shareVolume: boolean; partner: string; partnerId: string; bankProvider: string }
interface Offers { banks: { id: string; name: string }[]; fields: string[]; leads: { id: string; bank: string; fields: string[]; expiresAt: string; revokedAt: string | null }[] }

// Банк-партнёр в бухгалтерии: после перехода по ссылке банка (/partner/<код>) код привязывается к фирме, а вверху банка появляется шаг
// «подключить счёт этого банка». Отдельно — «Получить предложение банка»: клиент сам выбирает, какие данные передать, и может отозвать.
export default function PartnerOffer({ onConnect }: { onConnect?: (provider: string) => void }) {
	const t = useTranslations("partner");
	const [refs, setRefs] = useState<Referral[]>([]);
	const [offers, setOffers] = useState<Offers | null>(null);
	const [open, setOpen] = useState(false);
	const [bank, setBank] = useState("");
	const [fields, setFields] = useState<string[]>(["companyName", "contactEmail"]);

	const load = useCallback(async () => {
		const [m, o] = await Promise.all([apiCall<{ referrals: Referral[] }>("/api/partner/mine", "GET", undefined, { cache: "no-store" }), apiCall<Offers>("/api/bank-offers", "GET", undefined, { cache: "no-store" })]);
		if (m.ok && m.data) setRefs(m.data.referrals);
		if (o.ok && o.data) { setOffers(o.data); setBank((b) => b || o.data!.banks[0]?.id || ""); }
	}, []);

	useEffect(() => {
		void (async () => {
			let code = "", share = false;
			try { code = localStorage.getItem("partner.code") ?? ""; share = localStorage.getItem("partner.share") === "1"; } catch { /* нет хранилища */ }
			if (code) {
				const r = await apiCall("/api/partner/attach", "POST", { code, shareVolume: share });
				if (r.ok) { try { localStorage.removeItem("partner.code"); localStorage.removeItem("partner.share"); } catch { /* ок */ } }
			}
			await load();
		})();
	}, [load]);

	async function send() {
		const r = await apiCall("/api/bank-offers", "POST", { partnerId: bank, fields, days: 30 });
		if (!r.ok) return void toast.error(r.message);
		toast.success(t("offerSent"));
		setOpen(false);
		void load();
	}
	const revoke = async (id: string) => { const r = await apiCall(`/api/bank-offers/${id}`, "DELETE"); if (!r.ok) toast.error(r.message); else { toast.success(t("offerRevoked")); void load(); } };
	const toggleShare = async (r: Referral) => { const x = await apiCall("/api/partner/mine", "PATCH", { id: r.id, shareVolume: !r.shareVolume }); if (!x.ok) toast.error(x.message); else void load(); };

	if (!offers || (offers.banks.length === 0 && refs.length === 0)) return null;
	const active = offers.leads.filter((l) => !l.revokedAt && new Date(l.expiresAt) > new Date());
	return (
		<section className="fs-card mb-16 p-16">
			{refs.map((r) => (
				<div key={r.id} className="mb-10 flex flex-wrap items-center gap-x-12 gap-y-6 text-13 text-[#f1f4ee]">
					<span>{t("cameFrom", { bank: r.partner })}</span>
					{r.bankProvider && onConnect && <button type="button" className="fs-btn fs-btn-primary h-34 text-12" onClick={() => onConnect(r.bankProvider)}>{t("connectFirst", { bank: r.partner })}</button>}
					<label className="flex items-center gap-6 text-12 text-[#8c948b]"><input type="checkbox" checked={r.shareVolume} onChange={() => void toggleShare(r)} />{t("shareVolumeShort")}</label>
				</div>
			))}
			<div className="flex flex-wrap items-center gap-12">
				<span className="text-13 font-medium text-[#f1f4ee]">{t("offerTitle")}</span>
				<button type="button" className="fs-btn fs-btn-ghost h-34 text-12" onClick={() => setOpen(!open)}>{t("offerBtn")}</button>
			</div>
			{open && (
				<div className="mt-12 flex flex-col gap-10">
					<p className="text-12 leading-[1.5] text-[#8c948b]">{t("offerHint")}</p>
					<select className="fs-field h-38 px-10 text-13" value={bank} onChange={(e) => setBank(e.target.value)}>{offers.banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
					<div className="flex flex-wrap gap-14">
						{offers.fields.map((f) => (
							<label key={f} className="flex items-center gap-6 text-12 text-[#cfd4cb]"><input type="checkbox" checked={fields.includes(f)} onChange={(e) => setFields(e.target.checked ? [...fields, f] : fields.filter((x) => x !== f))} />{t(`field_${f}` as never)}</label>
						))}
					</div>
					<button type="button" disabled={!bank || !fields.length} onClick={() => void send()} className="fs-btn fs-btn-primary h-38 w-fit disabled:opacity-50">{t("offerSend")}</button>
				</div>
			)}
			{active.length > 0 && (
				<ul className="mt-12 flex flex-col gap-6">
					{active.map((l) => (
						<li key={l.id} className="flex flex-wrap items-center gap-x-12 text-12 text-[#8c948b]">
							<span>{t("offerActive", { bank: l.bank, date: new Date(l.expiresAt).toLocaleDateString() })}</span>
							<button type="button" className="text-[#ff9f9f] hover:underline" onClick={() => void revoke(l.id)}>{t("offerRevoke")}</button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
