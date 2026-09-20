import {create} from 'zustand';

interface Company {
  id: string;
  name: string;
}

interface CompanyStore {
  companies: Company[];
  selectedCompany: Company | null;
  fetchCompanies: () => Promise<void>;
  selectCompany: (company: Company) => void;
}

export const useCompanyStore = create<CompanyStore>((set) => ({
  companies: [],
  selectedCompany: null,
  fetchCompanies: async () => {
    // TODO: подключить, когда на сервере появится маршрут компаний
  },
  selectCompany: (company) => set({ selectedCompany: company }),
}));
