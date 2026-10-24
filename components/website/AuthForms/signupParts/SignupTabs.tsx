"use client";
import { IconContext } from "react-icons";
import { SIGNUP_TABS, SignupTab } from "./model";

interface Props {
	active: SignupTab;
	onChange: (tab: SignupTab) => void;
	label: (key: string) => string;
}

export default function SignupTabs({ active, onChange, label }: Props) {
	return (
		<div className="flex justify-between lg:justify-evenly mb-20">
			{SIGNUP_TABS.map(({ key, label: labelKey, Icon }) => (
				<button
					key={key}
					onClick={() => onChange(key)}
					className={`${
						active === key ? "bg-authBtn text-[#0A0A0A]" : "text-[#c6ff4d]"
					} border border-authTabBtn px-20 py-14 rounded-8 flex items-center`}>
					<div className="mr-8">
						<IconContext.Provider value={{ size: "22px", color: active === key ? "#0A0A0A" : "#c6ff4d" }}>
							<Icon />
						</IconContext.Provider>
					</div>
					<p>{label(labelKey)}</p>
				</button>
			))}
		</div>
	);
}
