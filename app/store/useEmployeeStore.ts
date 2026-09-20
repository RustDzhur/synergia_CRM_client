import { create } from "zustand";

interface Employee { _id: string; firstname: string; lastname: string; email: string; position?: string; department?: string; workPhone?: string; internalPhone?: string; avatarUrl?: string; }

interface EmployeeStore {
    items: Employee[];
    total: number;
    page: number;
    pages: number;
    isLoading: boolean;
    query: string;
    setQuery: (q: string) => void;
    fetchEmployees: (page?: number) => Promise<void>;
    addEmployee: (data: Partial<Employee>) => Promise<boolean>;
}

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

export const useEmployeeStore = create<EmployeeStore>((set, get) => ({
    items: [], total: 0, page: 1, pages: 1, isLoading: false, query: "",
    setQuery: (query) => set({ query }),
    fetchEmployees: async (page = 1) => {
        set({ isLoading: true });
        const { query } = get();
        const res = await fetch(`/api/employees?page=${page}&q=${encodeURIComponent(query)}`, { headers: authHeader() });
        const data = await res.json();
        set({ items: data.items ?? [], total: data.total ?? 0, page: data.page ?? 1, pages: data.pages ?? 1, isLoading: false });
    },
    addEmployee: async (data) => {
        const res = await fetch("/api/employees", { method: "POST", headers: { "Content-Type": "application/json", ...authHeader() }, body: JSON.stringify(data) });
        if (res.ok) { await get().fetchEmployees(get().page); return true; }
        return false;
    },
}));