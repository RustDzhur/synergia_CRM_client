import { create } from "zustand";
import type { Activity } from "@/app/types/crm";
import { api, addActivityRequest, removeActivityRequest } from "./crmApi";

export interface Task {
    _id: string;
    title: string;
    description?: string;
    deadline?: string; // "YYYY-MM-DDTHH:mm" (локальное время)
    responsible?: string;
    createdBy?: string;
    completed: boolean;
    pinned: boolean;
    muted: boolean;
    activities?: Activity[]; // комментарии: type "comment", meta — имя автора
    createdAt?: string;
    updatedAt?: string;
}

export type TaskInput = Partial<Pick<Task, "title" | "description" | "deadline" | "responsible" | "completed" | "pinned" | "muted">>;

export type TaskStatus = "active" | "completed" | "ended";

// Статус считается на лету: выполнена -> completed; не выполнена и срок прошёл -> ended; иначе active.
export function taskStatus(task: Task, now = Date.now()): TaskStatus {
    if (task.completed) return "completed";
    if (task.deadline && new Date(task.deadline).getTime() < now) return "ended";
    return "active";
}

interface TaskStore {
    tasks: Task[];
    isLoading: boolean;
    fetchTasks: () => Promise<void>;
    addTask: (data: TaskInput) => Promise<Task | null>;
    updateTask: (id: string, data: TaskInput) => Promise<Task | null>;
    deleteTasks: (ids: string[]) => Promise<void>;
    addComment: (id: string, text: string, author: string) => Promise<Task | null>;
    removeComment: (id: string, activityId: string) => Promise<Task | null>;
}

export const useTaskStore = create<TaskStore>((set, get) => {
    const upsert = (task: Task) => {
        const exists = get().tasks.some((t) => t._id === task._id);
        set({ tasks: exists ? get().tasks.map((t) => (t._id === task._id ? task : t)) : [task, ...get().tasks] });
    };

    return {
        tasks: [],
        isLoading: false,

        fetchTasks: async () => {
            set({ isLoading: true });
            const tasks = await api<Task[]>("/api/tasks");
            set({ tasks: tasks ?? get().tasks, isLoading: false });
        },

        addTask: async (data) => {
            const task = await api<Task>("/api/tasks", "POST", data);
            if (task) upsert(task);
            return task;
        },

        // переключатели (выполнено, закреплено) применяем сразу и откатываем при ошибке
        updateTask: async (id, data) => {
            const before = get().tasks;
            set({ tasks: before.map((t) => (t._id === id ? { ...t, ...data } : t)) });
            const task = await api<Task>(`/api/tasks/${id}`, "PATCH", data);
            if (task) upsert(task);
            else set({ tasks: before });
            return task;
        },

        deleteTasks: async (ids) => {
            const results = await Promise.all(ids.map((id) => api<{ ok: boolean }>(`/api/tasks/${id}`, "DELETE")));
            const deleted = ids.filter((_, i) => results[i]);
            set({ tasks: get().tasks.filter((t) => !deleted.includes(t._id)) });
        },

        addComment: async (id, text, author) => {
            const task = await addActivityRequest<Task>("tasks", id, { type: "comment", text, meta: author });
            if (task) upsert(task);
            return task;
        },

        removeComment: async (id, activityId) => {
            const task = await removeActivityRequest<Task>("tasks", id, activityId);
            if (task) upsert(task);
            return task;
        },
    };
});
