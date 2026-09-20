import { create } from "zustand";
import type { Activity } from "@/app/types/crm";
import { api, addActivityRequest, removeActivityRequest, NewActivity } from "./crmApi";

// Компании-клиенты (вкладка Companies в CRM). Не путать с useCompanyStore — там компании
// самого пользователя для переключателя «Switch Company» в шапке.
export interface ClientCompany {
    _id: string;
    name: string; // «Legal entity's full name»
    email?: string;
    field?: string;
    status?: string;
    code?: string;
    registrationDate?: string; // "YYYY-MM-DD"
    authorisedPerson?: string;
    businessType?: string;
    ownershipForm?: string;
    address?: string;
    activities?: Activity[];
    createdAt?: string;
    updatedAt?: string;
}

export type ClientCompanyInput = Partial<Omit<ClientCompany, "_id" | "activities" | "createdAt" | "updatedAt">>;

interface CompaniesStore {
    companies: ClientCompany[];
    isLoading: boolean;
    fetchCompanies: () => Promise<void>;
    getCompany: (id: string) => Promise<ClientCompany | null>;
    addCompany: (data: ClientCompanyInput) => Promise<ClientCompany | null>;
    updateCompany: (id: string, data: ClientCompanyInput) => Promise<ClientCompany | null>;
    deleteCompanies: (ids: string[]) => Promise<void>;
    addActivity: (id: string, activity: NewActivity) => Promise<ClientCompany | null>;
    removeActivity: (id: string, activityId: string) => Promise<ClientCompany | null>;
}

export const useCompaniesStore = create<CompaniesStore>((set, get) => {
    const upsert = (company: ClientCompany) => {
        const exists = get().companies.some((c) => c._id === company._id);
        set({
            companies: exists
                ? get().companies.map((c) => (c._id === company._id ? company : c))
                : [company, ...get().companies],
        });
    };

    return {
        companies: [],
        isLoading: false,

        fetchCompanies: async () => {
            set({ isLoading: true });
            const companies = await api<ClientCompany[]>("/api/companies");
            set({ companies: companies ?? get().companies, isLoading: false });
        },

        getCompany: (id) => api<ClientCompany>(`/api/companies/${id}`),

        addCompany: async (data) => {
            const created = await api<ClientCompany>("/api/companies", "POST", data);
            if (created) upsert(created);
            return created;
        },

        updateCompany: async (id, data) => {
            const updated = await api<ClientCompany>(`/api/companies/${id}`, "PATCH", data);
            if (updated) upsert(updated);
            return updated;
        },

        deleteCompanies: async (ids) => {
            const results = await Promise.all(ids.map((id) => api<{ ok: boolean }>(`/api/companies/${id}`, "DELETE")));
            const deleted = ids.filter((_, i) => results[i]);
            set({ companies: get().companies.filter((c) => !deleted.includes(c._id)) });
        },

        addActivity: async (id, activity) => {
            const updated = await addActivityRequest<ClientCompany>("companies", id, activity);
            if (updated) upsert(updated);
            return updated;
        },

        removeActivity: async (id, activityId) => {
            const updated = await removeActivityRequest<ClientCompany>("companies", id, activityId);
            if (updated) upsert(updated);
            return updated;
        },
    };
});
