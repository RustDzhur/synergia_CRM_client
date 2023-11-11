import {create} from 'zustand';

interface Language {
  code: string;
}

interface LanguageStore {
  selectedLanguage: Language;
  setSelectedLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageStore>((set) => ({
  selectedLanguage: { code: 'ua' },
  setSelectedLanguage: (language) => set({ selectedLanguage: language }),
}));
