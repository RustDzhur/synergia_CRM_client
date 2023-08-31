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
    try {
      const state = useSearchStore.getState(); // Access the current state
      const response = await fetch(`https://www.solar.com?q=${state.query}`);
      const data = await response.json();
      set({ searchData: data }); // Update the state with new data
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  },
}));
