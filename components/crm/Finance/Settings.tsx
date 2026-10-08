"use client";
import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { useFinanceStore } from "@/store/useFinanceStore";
import { useMarket } from "@/store/useMarket";
import { MARKET_DEFAULTS, marketDiff, registeredMarkets, type Market } from "@/lib/finance/market";
import { emptyUz, type UzProfile } from "@/lib/validation/uz";
import { fileToLogo, MAX_AVATAR_FILE_BYTES, MAX_LOGO_CHARS } from "@/utils/avatar";
import FormField from "../shared/FormField";
import TemplatePicker from "./TemplatePicker";
import UaProfileCard, { type UaProfileForm } from "./settingsParts/UaProfileCard";
import UzProfileCard from "./settingsParts/UzProfileCard";
import ExpenseCategoriesCard from "./settingsParts/ExpenseCategoriesCard";
import ContractTextCard from "./settingsParts/ContractTextCard";
import ActivitiesCard from "./settingsParts/ActivitiesCard";
import DocumentsCard from "./documentsParts/DocumentsCard";

// Поля манаведения появились в API позже, чем тип FinanceSettings в сторе (app/store/useFinanceStore.ts):
// читаем и сохраняем их рядом с остальными, не расширяя общий тип ради трёх полей.
type DunningFields = { dunningFees?: number[]; dunningInterestRate?: number; dunningPaymentDays?: number };

// Настройки бухгалтерии: страна определяет ставку налога по умолчанию на новых документах (её всё равно можно поменять
// на конкретном документе) — заполнять не обязательно, но без страны ставка по умолчанию 0 %. Остальное — реквизиты,
// контакты и свой текст, которые печатаются в шапке и подвале документов (lib/finance/layouts.ts), плюс логотип.
export default function FinanceSettingsTab() {
	const t = useTranslations("finance");
	const { settings, countries, loadSettings, saveSettings } = useFinanceStore();
	const { market } = useMarket();
	// Смена страны — отдельное действие с подтверждением: окно показывает, что скроется и что появится,
	// и предлагает применить набор по умолчанию. Данные подключений и документов не удаляются (ТЗ §3).
	const [switchTo, setSwitchTo] = useState<Market | null>(null);
	const [applyDefaults, setApplyDefaults] = useState(true);
	// пустые сборы = сборы не начисляются (как и на сервере); поля заполнятся настоящими значениями, когда придут настройки
	const [form, setForm] = useState({ country: "", currency: "EUR", smallBusiness: false, rateMargin: "0", uaLegalForm: "fop", uaTaxSystem: "single_3", uaGroup: "3", uaSingleRate: "5", uaVatPayer: false, uaVatRegDate: "", uaVatCertificate: "", uaVatRates: [20, 7, 0] as number[], uaEdrpou: "", uaIpn: "", uaKved: "", uaBank: "", uaIban: "", uaMfo: "", uaSignerName: "", uaSignerPosition: "", uaSignature: "", uaSeal: "", uaLimitsText: {} as Record<string, string>, uaEsvMonthly: "1760", uaMilitaryRate: "1", uaMilitaryFixed: "800", uaVatLimit: "1000000", uaVatPeriod: "month", legalName: "", address: "", taxId: "", vatId: "", registerNumber: "", managingDirector: "", phone: "", email: "", website: "", logo: "", footerText: "", iban: "", bic: "", paymentTermsDays: "14", invoicePrefix: "RE", quotePrefix: "AN", creditNotePrefix: "GS", reminderIntervalDays: "7", dunningFees: ["", "", "", "", ""], dunningInterestRate: "", dunningPaymentDays: "7", template: "classic", paymentQr: true });
	// Реквизиты рынка UZ живут отдельным объектом: на сервере это одно поле settings.uz
	const [uz, setUz] = useState<UzProfile>(emptyUz());
	const [saving, setSaving] = useState(false);
	const logoInput = useRef<HTMLInputElement>(null);

	useEffect(() => { loadSettings(); }, [loadSettings]);
	// Форму заполняем из настроек один раз (и заново при смене страны): раньше эффект срабатывал на любое
	// изменение settings — в том числе после сохранения соседней карточки, — и невинно набранные реквизиты
	// стирались с экрана, хотя в базу не попадали. Теперь ввод не перетирается чужими сохранениями.
	const hydratedCountry = useRef<string | null>(null);
	useEffect(() => {
		if (!settings) return;
		// страна в ответе та же, что уже показана, — значит, ввод трогать нельзя
		if (hydratedCountry.current === settings.country && form.country === settings.country) return;
		hydratedCountry.current = settings.country;
		setUz({ ...emptyUz(), ...(settings.uz ?? {}) });
		const dn = settings as typeof settings & DunningFields;
		// сборы по ступеням: индекс 0 в интерфейсе не используется, поэтому показываем ровно пять полей 0..4
		const fees = Array.from({ length: 5 }, (_, i) => (dn.dunningFees?.[i] !== undefined ? String(dn.dunningFees[i]) : ""));
		// Вписанные лимиты групп на текущий год — в текстовые поля; чужие годы живут в settings.uaLimits
		const year = new Date().getFullYear();
		const limitsText: Record<string, string> = {};
		for (const l of settings.uaLimits ?? []) if (l.year === year && l.amount > 0) limitsText[String(l.group)] = String(l.amount);
		setForm({ country: settings.country, currency: settings.currency, smallBusiness: settings.smallBusiness, rateMargin: String(settings.rateMargin ?? 0), uaLegalForm: settings.uaLegalForm ?? "fop", uaTaxSystem: settings.uaTaxSystem || (settings.uaLegalForm === "tov" ? "general_tov" : `single_${settings.uaGroup ?? 3}`), uaGroup: String(settings.uaGroup ?? 3), uaSingleRate: String(settings.uaSingleRate ?? 5), uaVatPayer: !!settings.uaVatPayer, uaVatRegDate: settings.uaVatRegDate ?? "", uaVatCertificate: settings.uaVatCertificate ?? "", uaVatRates: Array.isArray(settings.uaVatRates) && settings.uaVatRates.length ? settings.uaVatRates : [20, 7, 0], uaEdrpou: settings.uaEdrpou ?? "", uaIpn: settings.uaIpn ?? "", uaKved: (settings.uaKved ?? []).join(", "), uaBank: settings.uaBank ?? "", uaIban: settings.uaIban ?? "", uaMfo: settings.uaMfo ?? "", uaSignerName: settings.uaSignerName ?? "", uaSignerPosition: settings.uaSignerPosition ?? "", uaSignature: settings.uaSignature ?? "", uaSeal: settings.uaSeal ?? "", uaLimitsText: limitsText, uaEsvMonthly: String(settings.uaEsvMonthly ?? 1760), uaMilitaryRate: String(settings.uaMilitaryRate ?? 1), uaMilitaryFixed: String(settings.uaMilitaryFixed ?? 800), uaVatLimit: String(settings.uaVatLimit ?? 1000000), uaVatPeriod: settings.uaVatPeriod ?? "month", legalName: settings.legalName, address: settings.address, taxId: settings.taxId, vatId: settings.vatId, registerNumber: settings.registerNumber, managingDirector: settings.managingDirector, phone: settings.phone, email: settings.email, website: settings.website, logo: settings.logo, footerText: settings.footerText, iban: settings.iban, bic: settings.bic, paymentTermsDays: String(settings.paymentTermsDays), invoicePrefix: settings.invoicePrefix, quotePrefix: settings.quotePrefix, creditNotePrefix: settings.creditNotePrefix, reminderIntervalDays: String(settings.reminderIntervalDays), dunningFees: fees, dunningInterestRate: String(dn.dunningInterestRate ?? 0), dunningPaymentDays: String(dn.dunningPaymentDays ?? 7), template: settings.template || "classic", paymentQr: settings.paymentQr !== false });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [settings]);

	const selectedCountry = countries.find((c) => c.code === form.country);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		const err = await saveSettings({
			...form,
			paymentTermsDays: Number(form.paymentTermsDays) || 14,
			reminderIntervalDays: Number(form.reminderIntervalDays) || 7,
			// пустое поле сбора = 0: сбор не начисляется; проценты и срок приводим к диапазонам, которые принимает PATCH
			dunningFees: form.dunningFees.map((v) => Math.max(0, Number(v) || 0)),
			dunningInterestRate: Math.max(0, Math.min(30, Number(form.dunningInterestRate) || 0)),
			dunningPaymentDays: Math.max(1, Math.min(60, Math.round(Number(form.dunningPaymentDays) || 7))),
			// украинская налоговая модель: числа приходят строками из полей ввода
			...(market === "UZ" ? { uz } : {}),
			rateMargin: Math.max(0, Math.min(50, Number(form.rateMargin) || 0)),
			uaGroup: Number(form.uaGroup) || 3,
			uaSingleRate: Number(form.uaSingleRate) === 3 ? 3 : 5,
			uaEsvMonthly: Math.max(0, Number(form.uaEsvMonthly) || 0),
			uaMilitaryRate: Math.max(0, Number(form.uaMilitaryRate) || 0),
			uaMilitaryFixed: Math.max(0, Number(form.uaMilitaryFixed) || 0),
			uaVatLimit: Math.max(0, Number(form.uaVatLimit) || 1000000),
			// Полный профиль украинской фирмы (ТЗ §6): реквизиты уже проверены валидаторами под полями,
			// сервер проверит их ещё раз и ответит кодами ошибок
			uaTaxSystem: form.uaTaxSystem,
			uaVatRegDate: form.uaVatRegDate,
			uaVatCertificate: form.uaVatCertificate,
			uaVatRates: form.uaVatRates,
			uaEdrpou: form.uaEdrpou,
			uaIpn: form.uaIpn,
			uaKved: form.uaKved.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean),
			uaBank: form.uaBank,
			uaIban: form.uaIban,
			uaMfo: form.uaMfo,
			uaSignerName: form.uaSignerName,
			uaSignerPosition: form.uaSignerPosition,
			uaSignature: form.uaSignature,
			uaSeal: form.uaSeal,
			// Лимиты групп: вписанные значения — на текущий год; записи других лет и другие группы
			// текущего года сохраняются как были (раньше год заменялся целиком и группа 4 терялась)
			uaLimits: mergeLimits(settings?.uaLimits ?? [], form.uaLimitsText),
		} as any);
		setSaving(false);
		if (err) return toast.error(err);
		// Сервер сохранил всё, кроме полей с неверными реквизитами: говорим, что именно не сохранилось
		// и почему — раньше отказ приходил русской строкой, а форма продолжала показывать введённое
		const fieldErrors = (useFinanceStore.getState().settings as unknown as { fieldErrors?: Array<{ field: string; code: string }> } | null)?.fieldErrors ?? [];
		if (fieldErrors.length) {
			toast.error(t("uaErrSaved", { fields: fieldErrors.map((e) => t((e.field.startsWith("uz.") ? `uzErr_${e.code}` : `uaErr_${e.code}`) as never)).join(", ") }), { duration: 8000 });
			return;
		}
		toast.success(t("saved"));
	}

	// Логотип готовится в браузере тем же ресайзом, что и аватар (app/utils/avatar.ts): в настройки уходит маленький
	// data-URL, а сервер принимает картинку не больше MAX_LOGO_CHARS символов — иначе логотип молча очищался бы при сохранении.
	async function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = ""; // чтобы можно было выбрать тот же файл повторно
		if (!file) return;
		if (!file.type.startsWith("image/")) return void toast.error(t("logoNotImage"));
		if (file.size > MAX_AVATAR_FILE_BYTES) return void toast.error(t("logoTooBig"));
		try {
			const logo = await fileToLogo(file);
			if (logo.length > MAX_LOGO_CHARS) return void toast.error(t("logoTooBig"));
			setForm({ ...form, logo });
		} catch {
			toast.error(t("logoNotImage"));
		}
	}

	const label = "mb-6 block text-12 text-[#8c948b]";
	const hint = "mt-[4px] block text-11 text-[#9AA396]";

	return (
		<form onSubmit={submit} className="max-w-[640px]">
			{/* Виды деятельности фирмы: раньше мастер показывался один раз и пропадал — теперь его
			    всегда можно открыть здесь и добрать разделы (производство, опт, ВЭД) */}
			<ActivitiesCard />

			<div className="mb-16 fs-card p-16 md:p-20">
				<h3 className="mb-14 text-14 font-semibold text-[#f1f4ee]">{t("taxSection")}</h3>
				<div className="grid grid-cols-1 gap-12 md:grid-cols-2">
					{/* Страна — не выпадающий список «на будущее», а режим работы: смена показывает, что скроется,
					    и применяет набор по умолчанию. Существующие документы сохраняют свою валюту и формат. */}
					<div>
						<span className={label}>{t("market_current")}</span>
						<div className="flex items-center gap-10">
							<span className="fs-field flex h-40 flex-1 items-center px-12 text-13">{market ? t(`market_${market.toLowerCase()}`) : t("countryNone")}</span>
							<button type="button" onClick={() => { setApplyDefaults(true); setSwitchTo(registeredMarkets().find((m) => m !== market) ?? null); }} className="fs-btn fs-btn-ghost h-40">
								{t("market_change_btn")}
							</button>
						</div>
					</div>
					<FormField label={t("currency")} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={6} />
				</div>
				{/* Подсказка повторяет то, что реально делает код (lib/finance/tax.ts): у освобождённой фирмы ставка
				    страны не применяется вообще — 0 % и пометка §19 на каждом документе, поэтому и текст другой */}
				{market === "DE" && (form.smallBusiness ? (
					<p className="mt-8 text-12 text-[#9AA396]">{t("taxHintExempt")}</p>
				) : selectedCountry ? (
					<p className="mt-8 text-12 text-[#8c948b]">{t("taxHint", { rate: selectedCountry.standard, label: selectedCountry.label })}</p>
				) : null)}
				{/* Kleinunternehmerregelung §19 — немецкое поле; у украинской фирмы его место занимает «платник ПДВ» */}
				{market === "DE" && (
					<>
						<label className="mt-14 flex items-center gap-10 text-13 text-[#cfd4cb]">
							<input type="checkbox" checked={form.smallBusiness} onChange={(e) => setForm({ ...form, smallBusiness: e.target.checked })} className="h-16 w-16 accent-[#c6ff4d]" />
							{t("smallBusiness")}
						</label>
						<p className="mt-[4px] pl-[26px] text-11 text-[#9AA396]">{t("smallBusinessHint")}</p>
					</>
				)}
			</div>

			{/* Подтверждение смены режима: ничего не удаляется, но набор экранов, документов и интеграций
			    меняется целиком — человек должен видеть, что именно скроется и что появится (ТЗ §3). */}
			{switchTo && market && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,8,6,0.72)] p-16" role="dialog" aria-modal="true">
					<div className="w-full max-w-[520px] rounded-14 border border-[rgba(255,255,255,0.10)] bg-[#131715] p-20">
						<h3 className="text-15 font-semibold text-[#f1f4ee]">{t("market_change_title")}</h3>
						<p className="mt-8 text-13 text-[#cfd4cb]">{t("market_hint")}</p>
						<div className="mt-12 flex flex-wrap gap-8" role="radiogroup">
							{registeredMarkets().filter((m) => m !== market).map((m) => (
								<button key={m} type="button" role="radio" aria-checked={switchTo === m} onClick={() => setSwitchTo(m)} className={`fs-btn h-36 px-14 text-13 ${switchTo === m ? "fs-btn-primary" : "fs-btn-ghost"}`}>{t(`market_${m.toLowerCase()}` as never)}</button>
							))}
						</div>
						{(() => {
							const diff = marketDiff(market, switchTo);
							const name = (id: string) => (switchTo === "UA" && id === "vat" ? t("tab_ua_vat") : switchTo === "UA" && id === "eur" ? t("tab_ua_single") : switchTo === "UZ" && id === "vat" ? t("tab_uz_vat") : t(`tab_${id}`));
							return (
								<div className="mt-12 space-y-10">
									<div>
										<p className="mb-6 text-11 uppercase tracking-[0.08em] text-[#8c948b]">{t("market_change_hide")}</p>
										<p className="text-13 text-[#cfd4cb]">{diff.hidden.length ? diff.hidden.map(name).join(" · ") : t("market_change_same")}</p>
									</div>
									<div>
										<p className="mb-6 text-11 uppercase tracking-[0.08em] text-[#8c948b]">{t("market_change_show")}</p>
										<p className="text-13 text-[#cfd4cb]">{diff.shown.length ? diff.shown.map(name).join(" · ") : t("market_change_same")}</p>
									</div>
								</div>
							);
						})()}
						<label className="mt-14 flex items-start gap-10 text-13 text-[#cfd4cb]">
							<input type="checkbox" checked={applyDefaults} onChange={(e) => setApplyDefaults(e.target.checked)} className="mt-2 h-16 w-16 accent-[#c6ff4d]" />
							<span>{t("market_change_defaults")}</span>
						</label>
						<div className="mt-16 flex justify-end gap-10">
							<button type="button" onClick={() => setSwitchTo(null)} className="fs-btn fs-btn-ghost h-38">{t("market_change_cancel")}</button>
							<button
								type="button"
								onClick={async () => {
									const target = switchTo;
									setSwitchTo(null);
									const d = MARKET_DEFAULTS[target];
									const err = await saveSettings((applyDefaults ? { country: target, ...d } : { country: target }) as never);
									if (err) return toast.error(err);
									toast.success(t("saved"));
								}}
								className="fs-btn fs-btn-primary h-38">
								{t("market_change_confirm")}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Украинская налоговая модель: профиль фирмы целиком — система налогообложения, ПДВ,
			    реквизиты, банк, подписант с подписью и печатью, лимиты групп по годам (ТЗ §6) */}
			{market === "UA" && (
				<UaProfileCard
					form={form as unknown as UaProfileForm}
					set={(patch) => setForm({ ...form, ...patch } as typeof form)}
					year={new Date().getFullYear()}
				/>
			)}

			{/* Узбекистан: реквизиты (STIR, PINFL, MFO, счёт, режим QQS) и используемые налоговые правила с источниками */}
			{market === "UZ" && <UzProfileCard value={uz} onChange={setUz} />}

			{/* Налаштування → Документи: бланки документів с текстами, блоками, подписью и печатью (ТЗ §7) */}
			{market === "UA" && <DocumentsCard />}

			{/* Категории расходов: справочник для формы расхода и группировки в отчётах */}
			<ExpenseCategoriesCard />

			{/* Текст договора: типовой для фирмы, поля подставляются на месте {{…}} при печати PDF */}
			<ContractTextCard />

			<div className="mb-16 fs-card p-16 md:p-20">
				<h3 className="mb-14 text-14 font-semibold text-[#f1f4ee]">{t("companySection")}</h3>
				<div className="flex flex-col gap-12">
					<FormField label={t("legalName")} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} maxLength={200} />
					<FormField label={t("address")} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={500} />
					<div className="grid grid-cols-1 gap-12 md:grid-cols-2">
						<FormField label={t("taxId")} value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} maxLength={100} />
						<FormField label={t("vatId")} value={form.vatId} onChange={(e) => setForm({ ...form, vatId: e.target.value })} maxLength={100} />
					</div>
					<div className="grid grid-cols-1 gap-12 md:grid-cols-2">
						<FormField label={t("registerNumber")} value={form.registerNumber} onChange={(e) => setForm({ ...form, registerNumber: e.target.value })} maxLength={100} />
						<FormField label={t("managingDirector")} value={form.managingDirector} onChange={(e) => setForm({ ...form, managingDirector: e.target.value })} maxLength={100} />
					</div>
					<div className="grid grid-cols-1 gap-12 md:grid-cols-2">
						<FormField label="IBAN" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} maxLength={40} />
						<FormField label="BIC" value={form.bic} onChange={(e) => setForm({ ...form, bic: e.target.value })} maxLength={20} />
					</div>
				</div>
			</div>

			<div className="mb-16 fs-card p-16 md:p-20">
				<h3 className="mb-14 text-14 font-semibold text-[#f1f4ee]">{t("contactSection")}</h3>
				<div className="grid grid-cols-1 gap-12 md:grid-cols-2">
					<FormField label={t("phone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={100} />
					<FormField label={t("email")} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={100} />
				</div>
				<div className="mt-12">
					<FormField label={t("website")} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} maxLength={100} />
				</div>
			</div>

			<div className="mb-16 fs-card p-16 md:p-20">
				<h3 className="mb-14 text-14 font-semibold text-[#f1f4ee]">{t("documentSection")}</h3>
				<div className="flex flex-wrap items-start gap-14">
					<div className="flex h-[84px] w-[168px] shrink-0 items-center justify-center overflow-hidden rounded-10 border border-inkLine bg-[rgba(255,255,255,0.03)] p-8">
						{/* Превью того, что уйдёт в шапку PDF: белый фон — как у страницы документа */}
						{form.logo ? <img src={form.logo} alt={t("logo")} className="max-h-full max-w-full object-contain" /> : <span className="text-11 text-[#9AA396]">{t("logo")}</span>}
					</div>
					<div className="flex flex-col items-start gap-6">
						<button type="button" onClick={() => logoInput.current?.click()} className="fs-btn fs-btn-ghost h-34">{t("logoUpload")}</button>
						{form.logo && <button type="button" onClick={() => setForm({ ...form, logo: "" })} className="fs-link">{t("logoRemove")}</button>}
						<input ref={logoInput} type="file" accept="image/*" onChange={pickLogo} className="hidden" />
					</div>
				</div>
				<p className={hint}>{t("logoHint")}</p>
				<label className="mt-14 block">
					<span className={label}>{t("footerText")}</span>
					<textarea value={form.footerText} onChange={(e) => setForm({ ...form, footerText: e.target.value })} maxLength={1200} rows={3} className="fs-field fs-scroll w-full resize-none p-10 text-13 outline-none" />
					<span className={hint}>{t("footerTextHint")}</span>
				</label>
			</div>

			<div className="mb-16 fs-card p-16 md:p-20">
				<h3 className="mb-14 text-14 font-semibold text-[#f1f4ee]">{t("templateSection")}</h3>
				<p className="mb-14 text-12 text-[#8c948b]">{t("templateSectionHint")}</p>
				<TemplatePicker value={form.template || "classic"} onChange={(v) => setForm({ ...form, template: v || "classic" })} columns={5} />
				{/* EPC/SEPA-QR — немецкий способ оплаты по QR; украинскому счёту он ничего не даёт */}
				{market !== "UA" && (
					<>
						<label className="mt-16 flex items-center gap-10 text-13 text-[#cfd4cb]">
							<input type="checkbox" checked={form.paymentQr} onChange={(e) => setForm({ ...form, paymentQr: e.target.checked })} className="h-16 w-16 accent-[#c6ff4d]" />
							{t("paymentQr")}
						</label>
						<p className="mt-[4px] pl-[26px] text-11 text-[#9AA396]">{t("paymentQrHint")}</p>
					</>
				)}
			</div>

			<div className="mb-16 fs-card p-16 md:p-20">
				<h3 className="mb-14 text-14 font-semibold text-[#f1f4ee]">{t("invoiceSection")}</h3>
				<div className="grid grid-cols-1 gap-12 md:grid-cols-2">
					<FormField label={t("paymentTerms")} type="number" min={0} value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })} />
					<FormField label={t("reminderIntervalLabel")} type="number" min={1} max={90} value={form.reminderIntervalDays} onChange={(e) => setForm({ ...form, reminderIntervalDays: e.target.value })} />
					<FormField label={t("invoicePrefix")} value={form.invoicePrefix} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })} maxLength={10} />
					<FormField label={t("quotePrefix")} value={form.quotePrefix} onChange={(e) => setForm({ ...form, quotePrefix: e.target.value.toUpperCase() })} maxLength={10} />
					<FormField label={t("creditNotePrefixLabel")} value={form.creditNotePrefix} onChange={(e) => setForm({ ...form, creditNotePrefix: e.target.value.toUpperCase() })} maxLength={10} />
				</div>
			</div>

			{/* Манаведение: сбор за каждую ступень напоминания и справочная ставка процентов. Пока сборы не заполнены,
			    они нулевые — начислять их или нет, решает фирма, и подсказка говорит об этом прямо.
			    Mahnwesen — немецкий институт: украинской фирме его настройки не показываем. */}
			{market !== "UA" && (
			<div className="mb-16 fs-card p-16 md:p-20">
				<h3 className="mb-8 text-14 font-semibold text-[#f1f4ee]">{t("dunningSection")}</h3>
				<p className="mb-14 text-12 leading-[1.5] text-[#8c948b]">{t("dunningSettingsHint")}</p>
				<span className={label}>{t("dunningFeesLabel")}</span>
				<div className="grid grid-cols-2 gap-12 md:grid-cols-5">
					{form.dunningFees.map((v, i) => (
						<FormField
							key={i}
							label={i === 0 ? t("dunningFeeUnused") : t(`level_${i}`)}
							type="number"
							min={0}
							step="0.01"
							value={v}
							disabled={i === 0}
							className={i === 0 ? "opacity-50" : ""}
							onChange={(e) => setForm({ ...form, dunningFees: form.dunningFees.map((x, j) => (j === i ? e.target.value : x)) })}
						/>
					))}
				</div>
				<div className="mt-14 grid grid-cols-1 gap-12 md:grid-cols-2">
					<FormField label={t("dunningInterestLabel")} type="number" min={0} max={30} step="0.1" value={form.dunningInterestRate} onChange={(e) => setForm({ ...form, dunningInterestRate: e.target.value })} />
					<FormField label={t("dunningPaymentDaysLabel")} type="number" min={1} max={60} value={form.dunningPaymentDays} onChange={(e) => setForm({ ...form, dunningPaymentDays: e.target.value })} />
				</div>
			</div>
			)}

			{/* Сохранять можно только заполненную форму: отправка ненагруженной формы затёрла бы
			    страну и реквизиты значениями по умолчанию */}
			<button type="submit" disabled={saving || !settings} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{t("save")}</button>
		</form>
	);
}

// Лимиты групп по годам: вписанные в форму значения заменяют только свои пары «год-группа»,
// остальные записи (другие годы и другие группы текущего года) сохраняются из настроек как были.
// Очищенное поле снимает свой лимит, а не оставляет старое значение.
function mergeLimits(existing: Array<{ year: number; group: number; amount: number }>, text: Record<string, string>): Array<{ year: number; group: number; amount: number }> {
	const year = new Date().getFullYear();
	const touched = new Map<number, number>();
	for (const [group, v] of Object.entries(text)) {
		const g = Number(group);
		if (g >= 1 && g <= 4) touched.set(g, Number(v.replace(/\D/g, "")) || 0);
	}
	const out = existing.filter((l) => !(l.year === year && touched.has(l.group)));
	touched.forEach((amount, group) => { if (amount > 0) out.push({ year, group, amount }); });
	return out;
}
