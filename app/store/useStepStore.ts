import {create} from 'zustand';

interface StepStore {
  clickedStep: number;
  setClickedStep: (step: number) => void;
}

const useStepStore = create<StepStore>((set) => ({
  clickedStep: 10,
  setClickedStep: (step) => set({ clickedStep: step }),
}));

export default useStepStore;
