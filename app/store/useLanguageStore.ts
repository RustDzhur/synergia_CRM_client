import {create} from 'zustand';

interface Language {
  id: string;
  name: string;
  code: string;
}

interface LanguageStore {
  selectedLanguage: Language;
  setSelectedLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageStore>((set) => ({
  selectedLanguage: { id: 'ua', name: 'uk-UA', code: 'ua' },
  setSelectedLanguage: (language) => set({ selectedLanguage: language }),
}));
