"use client";
import React from "react";
import { SiGmail, SiIcloud, SiMicrosoftoffice, SiMicrosoftoutlook } from "react-icons/si";
import type { MailProviderId } from "@/types/integrations";

interface Provider { id: MailProviderId; label: string; logo: React.ReactNode }

const YAHOO = <span className="text-[34px] font-extrabold italic leading-none tracking-[-2px] text-[#6001D2]">yahoo!</span>;
const PROVIDERS: Provider[] = [
	{ id: "outlook", label: "Outlook", logo: <SiMicrosoftoutlook size={42} color="#0072C6" /> },
	{ id: "gmail", label: "Google Mail", logo: <SiGmail size={42} color="#EA4335" /> },
	{ id: "yahoo", label: "Yahoo", logo: YAHOO },
	{ id: "icloud", label: "iCloud", logo: <SiIcloud size={42} color="#3D9EEE" /> },
	{ id: "office365", label: "Office 365", logo: <SiMicrosoftoffice size={42} color="#D83B01" /> },
	{ id: "imap", label: "IMAP", logo: <span className="font-serif text-14 tracking-[1px] text-[#8c948b]">IMAP</span> },
];

// Плитки почтовых сервисов: выбор, куда подключать ящик
export default function ProviderGrid({ onPick }: { onPick: (id: MailProviderId) => void }) {
	return (
		<ul className="grid grid-cols-2 gap-16 md:grid-cols-4 md:gap-20">
			{PROVIDERS.map((p, i) => (
				<li key={i}>
					<button
						type="button"
						onClick={() => onPick(p.id)}
						className="fs-card flex h-[124px] w-full flex-col items-center justify-center gap-12 transition-transform duration-200 hover:-translate-y-2 md:h-[92px] md:gap-6 lg:h-[112px] lg:gap-10">
						<span className="flex h-[52px] items-center md:h-[36px] md:scale-[0.65] lg:h-[52px] lg:scale-90">{p.logo}</span>
						<span className="text-13 text-[#8c948b] lg:text-14">{p.label}</span>
					</button>
				</li>
			))}
		</ul>
	);
}
