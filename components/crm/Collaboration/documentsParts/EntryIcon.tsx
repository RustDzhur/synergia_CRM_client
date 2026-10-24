"use client";
import { TbFile, TbFolder, TbPhoto } from "react-icons/tb";
import type { DocItemDTO } from "@/types/documents";
import FileTypeIcon from "../FileTypeIcon";
import { ICON_TYPE } from "./model";

export default function EntryIcon({ doc, folder, size }: { doc?: DocItemDTO; folder?: boolean; size: number }) {
	if (folder) return <TbFolder size={size} className="shrink-0 text-[#FABF4D]" aria-hidden />;
	if (doc && doc.kind !== "file") return <FileTypeIcon type={ICON_TYPE[doc.kind]} size={size} withLabel={false} />;
	if (doc?.mime.startsWith("image/")) return <TbPhoto size={size} className="shrink-0 text-[#7CB305]" aria-hidden />;
	return <TbFile size={size} className="shrink-0 text-[#8c948b]" aria-hidden />;
}
