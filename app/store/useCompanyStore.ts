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
    try {
      //Change address
      const response = await fetch('https://your-api-url/companies');
      const companies = await response.json();
      set({ companies });
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  },
  selectCompany: (company) => set({ selectedCompany: company }),
}));
