"use client";
import React from "react";
import { useTranslations } from "next-intl";
import Modal from "@/components/crm/shared/Modal";
import PromoBanner from "@/components/shared/PromoBanner";

// Окно, которое открывают кнопки на карточках тарифов (пока действует программа «первые 500 — год бесплатно»): условия и
// счётчик мест, а дальше — кнопка перехода к регистрации. Оплата тарифов здесь не предлагается.
export default function PromoModal({ open, onClose, onRegister }: { open: boolean; onClose: () => void; onRegister: () => void }) {
	const t = useTranslations("promo");
	return (
		<Modal open={open} onClose={onClose} label={t("modalLabel")} align="top" className="w-full max-w-[880px]" flushOnMobile>
			<div className="fs-popover fs-scroll max-h-[92vh] overflow-y-auto p-16 md:p-24">
				<PromoBanner compact />
				<div className="flex flex-col-reverse gap-10 sm:flex-row sm:justify-end">
					<button type="button" onClick={onClose} className="fs-btn fs-btn-ghost h-48 px-24">{t("close")}</button>
					<button type="button" onClick={onRegister} className="fs-btn fs-btn-primary h-48 px-24 text-15">{t("goRegister")}</button>
				</div>
			</div>
		</Modal>
	);
}
