import { create } from "zustand";
import type { DocItemDTO, DocKind, DocsState, FolderDTO } from "@/app/types/documents";
import { apiCall, authHeaders } from "./crmApi";

interface Result { ok: boolean; message: string }

interface DocsStore {
    state: DocsState | null;
    loading: boolean;
    load: (refresh?: boolean) => Promise<void>;
    createFolder: (name: string, parent: string | null) => Promise<Result>;
    patchFolder: (id: string, patch: { name?: string; parent?: string | null }) => Promise<Result>;
    deleteFolder: (id: string) => Promise<Result>;
    createDoc: (kind: Exclude<DocKind, "file">, name: string, folder: string | null) => Promise<Result & { doc?: DocItemDTO }>;
    patchDoc: (id: string, patch: { name?: string; folder?: string | null; archived?: boolean }) => Promise<Result>;
    deleteDoc: (id: string) => Promise<Result>;
    upload: (file: File, folder: string | null) => Promise<Result>;
    connectDrive: (locale: string) => Promise<Result>;
    disconnectDrive: () => Promise<void>;
}

export const useDocsStore = create<DocsStore>()((set, get) => {
    const patchState = (fn: (s: DocsState) => DocsState) => {
        const s = get().state;
        if (s) set({ state: fn(s) });
    };
    const replaceDoc = (d: DocItemDTO) => patchState((s) => ({ ...s, docs: s.docs.some((x) => x.id === d.id) ? s.docs.map((x) => (x.id === d.id ? d : x)) : [d, ...s.docs] }));
    const replaceFolder = (f: FolderDTO) => patchState((s) => ({ ...s, folders: (s.folders.some((x) => x.id === f.id) ? s.folders.map((x) => (x.id === f.id ? f : x)) : [...s.folders, f]).sort((a, b) => a.name.localeCompare(b.name)) }));

    return {
        state: null,
        loading: false,

        load: async (refresh = false) => {
            set({ loading: true });
            const res = await apiCall<DocsState>(`/api/documents${refresh ? "?refresh=1" : ""}`);
            set({ loading: false, ...(res.ok && res.data ? { state: res.data } : {}) });
        },

        createFolder: async (name, parent) => {
            const res = await apiCall<FolderDTO>("/api/documents/folders", "POST", { name, parent });
            if (res.ok && res.data) replaceFolder(res.data);
            return { ok: res.ok, message: res.message };
        },
        patchFolder: async (id, patch) => {
            const res = await apiCall<FolderDTO>(`/api/documents/folders/${id}`, "PATCH", patch);
            if (res.ok && res.data) replaceFolder(res.data);
            return { ok: res.ok, message: res.message };
        },
        deleteFolder: async (id) => {
            const res = await apiCall(`/api/documents/folders/${id}`, "DELETE");
            if (res.ok) patchState((s) => ({ ...s, folders: s.folders.filter((f) => f.id !== id) }));
            return { ok: res.ok, message: res.message };
        },

        createDoc: async (kind, name, folder) => {
            const res = await apiCall<DocItemDTO>("/api/documents", "POST", { kind, name, folder });
            if (res.ok && res.data) replaceDoc(res.data);
            return { ok: res.ok, message: res.message, doc: res.data ?? undefined };
        },
        patchDoc: async (id, patch) => {
            const res = await apiCall<DocItemDTO>(`/api/documents/${id}`, "PATCH", patch);
            if (res.ok && res.data) replaceDoc(res.data);
            return { ok: res.ok, message: res.message };
        },
        deleteDoc: async (id) => {
            const res = await apiCall(`/api/documents/${id}`, "DELETE");
            if (res.ok) patchState((s) => ({ ...s, docs: s.docs.filter((d) => d.id !== id) }));
            return { ok: res.ok, message: res.message };
        },

        // Загрузка файла: multipart без заголовка Content-Type (его выставит браузер вместе с границей)
        upload: async (file, folder) => {
            const body = new FormData();
            body.append("file", file);
            if (folder) body.append("folder", folder);
            try {
                const res = await fetch("/api/documents/upload", { method: "POST", headers: authHeaders(false), body });
                const json = await res.json().catch(() => null);
                if (!res.ok) return { ok: false, message: json?.message ?? `Error ${res.status}` };
                replaceDoc(json as DocItemDTO);
                return { ok: true, message: "" };
            } catch {
                return { ok: false, message: "Network error" };
            }
        },

        connectDrive: async (locale) => {
            const res = await apiCall<{ url: string }>("/api/drive/oauth", "POST", { locale });
            if (res.ok && res.data?.url) window.location.href = res.data.url;
            return { ok: res.ok, message: res.message };
        },
        disconnectDrive: async () => {
            await apiCall("/api/drive", "DELETE");
            patchState((s) => ({ ...s, drive: { ...s.drive, connected: false, email: "" } }));
        },
    };
});
