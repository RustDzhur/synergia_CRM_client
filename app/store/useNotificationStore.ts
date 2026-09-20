import {create} from 'zustand';

interface NotificationStore {
  hasNotifications: boolean;
  numberNotification: number;
  toggleNotifications: () => void;
  fetchNotifications: () => Promise<void>;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  hasNotifications: false,
  numberNotification: 0,
  toggleNotifications: () => set((state) => ({ hasNotifications: !state.hasNotifications })),
  fetchNotifications: async () => {
    // TODO: подключить, когда на сервере появится маршрут уведомлений
  },
}));
