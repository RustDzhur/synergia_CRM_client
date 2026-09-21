// Типы, общие для сервера и клиента раздела Online Documents
export type DocKind = "gdoc" | "gsheet" | "gslide" | "file";

export interface FolderDTO {
    id: string;
    name: string;
    parent: string | null;
}

export interface DocItemDTO {
    id: string;
    kind: DocKind;
    name: string;
    folder: string | null;
    archived: boolean;
    createdBy: string;
    url: string; // для Google-документов
    mime: string;
    size: number;
    modifiedAt: string;
    createdAt: string;
}

export interface DocsState {
    folders: FolderDTO[];
    docs: DocItemDTO[];
    drive: { configured: boolean; connected: boolean; email: string };
    storage: { configured: boolean; maxMb: number };
}
