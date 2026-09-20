import { create } from "zustand";
import type { Activity } from "@/app/types/crm";
import { api, addActivityRequest, removeActivityRequest, NewActivity } from "./crmApi";

export interface Contact {
    _id: string;
    name: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    company?: string;
    position?: string;
    website?: string;
    twitter?: string;
    facebook?: string;
    notes?: string;
    activities?: Activity[];
    createdAt?: string;
    updatedAt?: string;
}

export type ContactInput = Partial<Omit<Contact, "_id" | "name" | "activities" | "createdAt" | "updatedAt">>;

interface ContactStore {
    contacts: Contact[];
    isLoading: boolean;
    fetchContacts: () => Promise<void>;
    getContact: (id: string) => Promise<Contact | null>;
    addContact: (data: ContactInput) => Promise<Contact | null>;
    updateContact: (id: string, data: ContactInput) => Promise<Contact | null>;
    deleteContacts: (ids: string[]) => Promise<void>;
    addActivity: (id: string, activity: NewActivity) => Promise<Contact | null>;
    removeActivity: (id: string, activityId: string) => Promise<Contact | null>;
}

export const useContactStore = create<ContactStore>((set, get) => {
    const upsert = (contact: Contact) => {
        const exists = get().contacts.some((c) => c._id === contact._id);
        set({
            contacts: exists
                ? get().contacts.map((c) => (c._id === contact._id ? contact : c))
                : [contact, ...get().contacts],
        });
    };

    return {
        contacts: [],
        isLoading: false,

        fetchContacts: async () => {
            set({ isLoading: true });
            const contacts = await api<Contact[]>("/api/contacts");
            set({ contacts: contacts ?? get().contacts, isLoading: false });
        },

        getContact: (id) => api<Contact>(`/api/contacts/${id}`),

        addContact: async (data) => {
            const created = await api<Contact>("/api/contacts", "POST", data);
            if (created) upsert(created);
            return created;
        },

        updateContact: async (id, data) => {
            const updated = await api<Contact>(`/api/contacts/${id}`, "PATCH", data);
            if (updated) upsert(updated);
            return updated;
        },

        deleteContacts: async (ids) => {
            const results = await Promise.all(ids.map((id) => api<{ ok: boolean }>(`/api/contacts/${id}`, "DELETE")));
            const deleted = ids.filter((_, i) => results[i]);
            set({ contacts: get().contacts.filter((c) => !deleted.includes(c._id)) });
        },

        addActivity: async (id, activity) => {
            const updated = await addActivityRequest<Contact>("contacts", id, activity);
            if (updated) upsert(updated);
            return updated;
        },

        removeActivity: async (id, activityId) => {
            const updated = await removeActivityRequest<Contact>("contacts", id, activityId);
            if (updated) upsert(updated);
            return updated;
        },
    };
});
