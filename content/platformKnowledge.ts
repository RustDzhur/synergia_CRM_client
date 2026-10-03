import { PLANS, YEAR_MONTHS } from "@/config/plans";
import { CHATBOT_FAQ } from "./chatbotFaq";
import { tx } from "./i18n";

// Всё, что публичная Айрис (бот на лендинге) знает о платформе. Она отвечает ТОЛЬКО по этому тексту; чего здесь нет — передаёт
// вопрос человеку. Цены и лимиты берутся из config/plans.ts (один источник правды), ответы на частые вопросы — из
// content/chatbotFaq.ts, остальное описано здесь. Добавили функцию в платформу — допишите её сюда, и Айрис начнёт о ней рассказывать.
// Текст на английском: модель отвечает посетителю на языке его вопроса.

const FEATURE_LABEL: Record<string, string> = {
    crm: "CRM (deals pipeline, contacts, companies)", tasks: "Tasks and Projects", company: "My Company (employees, knowledge base)",
    collab: "Feed and Calendar", documents: "Online Documents", channels: "Chat and Calls (Telegram, Viber, Messenger, WhatsApp, web chat, phone)",
    mail: "Web Mails (connect Gmail/Outlook/IMAP, leads from e-mails)", inventory: "Finance (invoices, quotes, orders, contracts, expenses, warehouse, purchasing, taxes, reports)",
    automation: "Automation (rule builder)", aiAssistant: "Ayris AI assistant", marketing: "Marketing (campaigns, segments, templates)",
    multiFirm: "several firms under one account, team roles", ads: "Ad performance (Google Ads / Meta Ads)", aiAutomation: "AI step in automation",
};

function plansText(): string {
    return PLANS.map((p) => {
        const on = Object.entries(p.features).filter(([, v]) => v).map(([k]) => FEATURE_LABEL[k] ?? k);
        return [
            `- ${p.id.toUpperCase()}: ${p.priceMonth === 0 ? "free" : `€${p.priceMonth} per month (yearly billing = ${YEAR_MONTHS} months, two months free)`}`,
            `  users: ${p.users === null ? "unlimited" : `up to ${p.users}`}`,
            p.features.automation ? `  automation rules: up to ${p.automationRules}` : "",
            p.features.aiAssistant ? `  AI assistant conversations: ${p.aiDailyRequests} per day per firm` : "",
            p.features.documents ? `  document storage: ${p.storageMb >= 1000 ? p.storageMb / 1000 + " GB" : p.storageMb + " MB"}` : "",
            `  includes: ${on.join("; ")}`,
        ].filter(Boolean).join("\n");
    }).join("\n");
}

export function platformKnowledge(): string {
    return `# Firmspace AI — platform knowledge

## What it is
Firmspace AI is an all-in-one business platform for small and medium companies, in German, Ukrainian and English: CRM, team collaboration, communication channels, accounting/finance with warehouse, marketing, automation and an AI assistant (Ayris) — in one place, with one login. Websites: firmspace.de.

## Main areas
- CRM: sales pipeline as a kanban board (drag cards between stages, mark deals won), list view, deal cards with history, contacts and companies, notes, tasks and calls from a card, leads created automatically from incoming e-mails and chat messages, import of contacts.
- Tasks and Projects: tasks with deadlines and reminders, projects, calendar view.
- Collaboration: team feed, calendar (two-way sync with Google Calendar, read-only iCloud), online documents and folders, chat and calls, web mail.
- Chat and Calls: one inbox for Telegram, Viber, Facebook Messenger, WhatsApp, the website chat widget, and phone calls (Twilio or your own SIP provider). Answer customers from the CRM; conversations are linked to contacts.
- Web Mails: connect Gmail, Outlook or any IMAP/SMTP mailbox; read, write and reply inside the CRM; incoming e-mails can create leads automatically; mail is synced in the background.
- Finance (accounting): quotes → orders → invoices → contracts; invoices with PDF, e-mail sending, payment links, partial payments, credit notes, recurring invoices; dunning/reminders; expenses with categories; bank accounts and CSV statement import with matching; products, warehouses, stock movements, purchasing (suppliers, purchase orders, incoming goods), production (bills of materials), fixed assets; reports and taxes. Germany mode: invoices with the legally required details (§14 UStG), dunning levels, SEPA payment QR code, VAT return overview, BWA/SuSa, EÜR. Ukraine mode: acts of services, delivery notes, fiscal receipts via PRRO (Checkbox), VAT and single tax, Nova Poshta and Ukrposhta shipping, cash register (POS). A company works in one country mode.
- Marketing: campaigns, segments, templates, ad performance for Google Ads and Meta Ads.
- Automation: rules "event → delay → action" (new deal, stage change, new contact, lead from e-mail, message in a channel, missed call, task deadline; actions: notification, task, note, move deal, send e-mail, webhook). Optional AI step that decides and acts.
- Teams and roles: several firms under one account; invite employees; roles Owner, Admin, Manager, Employee, Viewer with per-section access.
- Notifications: bell in the app, browser notifications, optional Telegram bot that sends work notifications to the team.

## Ayris — the AI assistant
- Chat inside the CRM that reads real CRM data (contacts, deals, tasks, e-mails, documents, invoices, stock) and prepares or performs actions: create tasks, deals, contacts, invoices, quotes, orders, contracts, expenses; move deals; confirm orders; mark invoices paid; order from suppliers; send invoices and reports by e-mail; read PDF documents and e-mails; summarize customers; draft replies.
- Voice control: the user says "Hi Ayris, open accounting and show unpaid invoices" on any page; she opens pages, answers aloud with a natural voice, creates and changes records, fills cards. Works in Chrome, Edge and Safari. Several tasks in one message are processed one by one.
- Telegram: the user can talk to Ayris in her own Telegram bot by text or voice message.
- Connect your own AI agent or bot: in Settings → Integrations a firm creates an access key, chooses the sections and whether the agent may only read or also change things (changes wait for the owner's approval by default), and pastes one address and the key into Claude, ChatGPT, Cursor, n8n, Zapier or any MCP-compatible agent — no servers or files needed. Included in plans with the AI assistant.
- Safety: she works with the user's own rights, changes can be confirmed before they run (or run immediately if the user turns that on); deleting always asks first; she remembers what the user teaches her.
- AI assistant availability depends on the plan (see plans).

## Plans and prices
${plansText()}
All prices are per firm. A free plan exists; registration needs no credit card.

## Payments and billing
Details about paying for a subscription, invoices from Firmspace, refunds or a specific account are handled by the team — hand over to the operator instead of guessing.

## Security and data
Data belongs to the firm; access is per role; connection credentials are stored encrypted; sign-in with e-mail and password.

## Support and contact
Questions that need a person (billing problems, a specific account, contracts, partnerships, custom features, bugs): hand over to the team. The operator answers in this chat during working hours; the visitor can leave an e-mail or phone number.

## Frequently asked questions (approved answers)
${CHATBOT_FAQ.map((e) => `Q: ${tx(e.q, "en")}\nA: ${tx(e.a, "en")}`).join("\n\n")}
`;
}
