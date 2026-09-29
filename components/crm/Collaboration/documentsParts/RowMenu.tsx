"use client";
import React, { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TbDots } from "react-icons/tb";
import Dropdown from "@/utils/Dropdown";
import { useClickOutside } from "@/utils/useClickOutside";
import type { Action } from "./model";

export default function RowMenu({ actions }: { actions: Action[] }) {
	const t = useTranslations("collab");
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, open, () => setOpen(false));
	const item = "fs-popover-row block w-full px-14 py-10 text-left text-13 transition-colors duration-150";
	return (
		<div ref={ref} className="relative inline-block">
			<button type="button" aria-label={t("more")} aria-expanded={open} onClick={() => setOpen(!open)} className="text-[#8c948b] transition-colors hover:text-[#c6ff4d]">
				<TbDots size={20} />
			</button>
			<Dropdown open={open} className="right-0 top-full mt-8 min-w-[190px]">
				<div className="fs-popover overflow-hidden py-2 text-left">
					{actions.map((a, i) => (
						<React.Fragment key={a.label}>
							{a.danger && i > 0 && <div className="border-t border-inkLine" />}
							<button type="button" className={`${item} ${a.danger ? "!text-danger" : ""}`} onClick={() => { setOpen(false); a.onClick(); }}>{a.label}</button>
						</React.Fragment>
					))}
				</div>
			</Dropdown>
		</div>
	);
}
