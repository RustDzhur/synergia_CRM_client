"use client";
import { useRef, useState } from "react";
import Dropdown from "@/utils/Dropdown";
import { useClickOutside } from "@/utils/useClickOutside";

interface Props {
	options: Array<{ label: string; danger?: boolean; onClick: () => void }>;
	children: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
	align?: "left" | "right";
}

export default function Menu({ options, children, align = "left" }: Props) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, open, () => setOpen(false));
	return (
		<div ref={ref} className="relative inline-block">
			{children({ open, toggle: () => setOpen(!open) })}
			<Dropdown open={open} className={`${align === "left" ? "left-0" : "right-0"} top-full mt-8 min-w-[190px]`}>
				<div className="fs-popover overflow-hidden py-4 text-left">
					{options.map((o, i) => (
						<div key={o.label}>
							{i > 0 && <div className="my-4 border-t border-inkLine" />}
							<button
								type="button"
								onClick={() => { setOpen(false); o.onClick(); }}
								className={`fs-popover-row block w-full px-14 py-10 text-left text-13 transition-colors duration-150 ${o.danger ? "!text-danger" : ""}`}>
								{o.label}
							</button>
						</div>
					))}
				</div>
			</Dropdown>
		</div>
	);
}
