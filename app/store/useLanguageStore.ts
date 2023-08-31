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
  selectedLanguage: { id: 'default', name: 'Default Language', code: 'en-US' },
  setSelectedLanguage: (language) => set({ selectedLanguage: language }),
}));
