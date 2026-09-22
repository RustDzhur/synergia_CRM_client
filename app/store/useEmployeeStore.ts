import { create } from "zustand";
import { api } from "./crmApi";

export interface Employee {
    _id: string;
    firstname: string;
    lastname: string;
    email: string;
    position?: string;
    department?: string;
    workPhone?: string;
    internalPhone?: string;
    avatarUrl?: string;
    contractType?: string;
    contractStart?: string;
    contractNote?: string;
}

export type EmployeeInput = Partial<Omit<Employee, "_id" | "avatarUrl">>;

interface EmployeeStore {
    items: Employee[];
    total: number;
    page: number;
    pages: number;
    isLoading: boolean;
    query: string;
    setQuery: (q: string) => void;
    fetchEmployees: (page?: number) => Promise<void>;
    addEmployee: (data: EmployeeInput) => Promise<boolean>;
    updateEmployee: (id: string, data: EmployeeInput) => Promise<boolean>;
    deleteEmployee: (id: string) => Promise<boolean>;
}

interface ListResponse { items: Employee[]; total: number; page: number; pages: number }

export const useEmployeeStore = create<EmployeeStore>((set, get) => ({
    items: [], total: 0, page: 1, pages: 1, isLoading: false, query: "",
    setQuery: (query) => set({ query }),

    fetchEmployees: async (page = 1) => {
        set({ isLoading: true });
        const data = await api<ListResponse>(`/api/employees?page=${page}&q=${encodeURIComponent(get().query)}`);
        if (data) set({ items: data.items, total: data.total, page: data.page, pages: data.pages, isLoading: false });
        else set({ isLoading: false });
    },

    addEmployee: async (data) => {
        const created = await api<Employee>("/api/employees", "POST", data);
        if (created) await get().fetchEmployees(1);
        return Boolean(created);
    },

    updateEmployee: async (id, data) => {
        const updated = await api<Employee>(`/api/employees/${id}`, "PATCH", data);
        if (updated) set({ items: get().items.map((e) => (e._id === id ? updated : e)) });
        return Boolean(updated);
    },

    deleteEmployee: async (id) => {
        const res = await api<{ ok: boolean }>(`/api/employees/${id}`, "DELETE");
        if (res) {
            // если удалили последнюю запись на странице — возвращаемся на предыдущую
            const { page, items } = get();
            await get().fetchEmployees(items.length === 1 && page > 1 ? page - 1 : page);
        }
        return Boolean(res);
    },
}));
