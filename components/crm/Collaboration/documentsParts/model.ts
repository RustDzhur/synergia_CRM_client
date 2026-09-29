import type { DocItemDTO, DocKind, FolderDTO } from "@/types/documents";

export type Layout = "list" | "grid" | "tile";
export type StatusFilter = "active" | "archived" | "all";
export type GoogleKind = Exclude<DocKind, "file">;
export const GOOGLE_KINDS: GoogleKind[] = ["gdoc", "gsheet", "gslide"];
export const ICON_TYPE = { gdoc: "docx", gsheet: "xlsx", gslide: "pptx" } as const;
export const INLINE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

export type NameMode = { kind: "doc"; docKind: GoogleKind } | { kind: "folder-new" } | { kind: "folder-rename"; folder: FolderDTO } | { kind: "doc-rename"; doc: DocItemDTO };
export type Target = { type: "folder"; folder: FolderDTO } | { type: "doc"; doc: DocItemDTO };
export interface Action { label: string; onClick: () => void; danger?: boolean }

export const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
