import { create } from "zustand";

export interface Contact {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    position?: string;
    notes?: string;
}

interface ContactStore {
    contacts: Contact[];
    isLoading: boolean;
    fetchContacts: () => Promise<void>;
    addContact: (data: Partial<Contact>) => Promise<void>;
    updateContact: (id: string, data: Partial<Contact>) => Promise<void>;
    deleteContact: (id: string) => Promise<void>;
}

function authHeaders() {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
    };
}

export const useContactStore = create<ContactStore>((set, get) => ({
    contacts: [],
    isLoading: false,

    fetchContacts: async () => {
        set({ isLoading: true });
        const res = await fetch("/api/contacts", { headers: authHeaders() });
        if (res.ok) set({ contacts: await res.json(), isLoading: false });
        else set({ isLoading: false });
    },

    addContact: async (data) => {
        const res = await fetch("/api/contacts", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify(data),
        });
        if (res.ok) {
            const created = await res.json();
            set({ contacts: [created, ...get().contacts] });
        }
    },

    updateContact: async (id, data) => {
        const res = await fetch(`/api/contacts/${id}`, {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify(data),
        });
        if (res.ok) {
            const updated = await res.json();
            set({ contacts: get().contacts.map((c) => (c._id === id ? updated : c)) });
        }
    },

    deleteContact: async (id) => {
        const res = await fetch(`/api/contacts/${id}`, {
            method: "DELETE",
            headers: authHeaders(),
        });
        if (res.ok) {
            set({ contacts: get().contacts.filter((c) => c._id !== id) });
        }
    },
}));