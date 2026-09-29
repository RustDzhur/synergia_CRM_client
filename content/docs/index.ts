import { AI } from "./ai";
import { AUTOMATION } from "./automation";
import { BILLING_DOCS } from "./billing";
import { COLLAB_CALENDAR } from "./collabCalendar";
import { COLLAB_CHAT } from "./collabChat";
import { COLLAB_DOCS } from "./collabDocs";
import { COLLAB_FEED } from "./collabFeed";
import { COLLAB_MAIL } from "./collabMail";
import { COMPANY_DOCS } from "./company";
import { CRM } from "./crm";
import { FINANCE } from "./finance";
import { INTEGRATIONS_DOCS } from "./integrations";
import { MARKETING_DOCS } from "./marketing";
import { SETTINGS_DOCS } from "./settings";
import { START } from "./start";
import { TABLES } from "./tables";
import { TASKS } from "./tasks";
import type { DocSection } from "./types";

// Порядок совпадает с меню кабинета; id разделов связаны с DOC_SECTION_OF_MENU в Documentation.tsx.
export const DOC_SECTIONS: DocSection[] = [
	...START,
	...CRM,
	...TASKS,
	...FINANCE,
	...AUTOMATION,
	...AI,
	...MARKETING_DOCS,
	...TABLES,
	...COLLAB_FEED,
	...COLLAB_CHAT,
	...COLLAB_CALENDAR,
	...COLLAB_DOCS,
	...COLLAB_MAIL,
	...COMPANY_DOCS,
	...SETTINGS_DOCS,
	...INTEGRATIONS_DOCS,
	...BILLING_DOCS,
];
