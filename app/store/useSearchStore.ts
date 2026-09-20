import {create} from 'zustand';

interface SearchStore {
  query: string;
  setQuery: (query: string) => void;
  searchData: any[]; // Adjust the type accordingly
  fetchSearchData: () => Promise<void>;
}

export const useSearchStore = create<SearchStore>((set) => ({
  query: '',
  setQuery: (query) => set({ query }),
  searchData: [],

  fetchSearchData: async () => {
    // TODO: подключить, когда на сервере появится маршрут поиска
  },
}));
