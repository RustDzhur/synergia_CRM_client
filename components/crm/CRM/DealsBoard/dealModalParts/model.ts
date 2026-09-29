export type SectionKey = "more" | "recurring";

export interface AboutDraft {
	clientName: string;
	stage: string;
	startDate: string;
	contactName: string;
	companyName: string;
	contact: string;
	company: string;
}

export interface MoreDraft {
	dealType: string;
	responsible: string;
	availableToAll: boolean;
	utm: string;
}

export const EMPTY_ABOUT: AboutDraft = { clientName: "", stage: "", startDate: "", contactName: "", companyName: "", contact: "", company: "" };
export const EMPTY_MORE: MoreDraft = { dealType: "", responsible: "", availableToAll: true, utm: "" };
