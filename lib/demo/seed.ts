import { prisma } from "@/lib/prisma";
import { ensureStages } from "@/lib/stages";
import { ensureStarters, createTask, updateTask, listRobots } from "@/lib/office/store";

// Наполнение демо-кабинета: «живая» немецкая фирма с клиентами, сделками, задачами, складом, счетами и роботами в офисе.
// Всегда ОДНО И ТО ЖЕ (никакой случайности): каждый посетитель получает одинаковую копию. Даты считаются от сегодняшнего дня,
// поэтому кабинет не выглядит заброшенным. Всё хранится как обычные записи демо-фирмы и удаляется вместе с ней (lib/demo/index.ts).

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const money = (v: number) => Math.round(v * 100) / 100;

const COMPANIES = [
    { name: "Nordlicht AG", field: "Logistik", address: "Hafenstraße 12, 20457 Hamburg" },
    { name: "Berger Handel GmbH", field: "Großhandel", address: "Kaiserstraße 44, 60329 Frankfurt" },
    { name: "Weber & Söhne", field: "Maschinenbau", address: "Industrieweg 7, 70565 Stuttgart" },
    { name: "Klein Technik GmbH", field: "IT-Dienstleistungen", address: "Leopoldstraße 90, 80802 München" },
    { name: "Acme Bau GmbH", field: "Bauwesen", address: "Münsterstraße 5, 44145 Dortmund" },
    { name: "Hoffmann Möbel", field: "Einzelhandel", address: "Lange Straße 21, 30159 Hannover" },
];

const PEOPLE = [
    ["Anna", "Meier", 0, "Einkaufsleiterin"], ["Tom", "Klein", 3, "Geschäftsführer"], ["Maria", "Weber", 2, "Buchhaltung"],
    ["Lukas", "Berger", 1, "Inhaber"], ["Sophie", "Hoffmann", 5, "Filialleiterin"], ["Jan", "Schulz", 4, "Projektleiter"],
    ["Eva", "Nowak", 0, "Disponentin"], ["Paul", "Richter", 1, "Einkauf"], ["Lena", "Krause", 3, "CTO"],
    ["Felix", "Wagner", 2, "Produktion"], ["Clara", "Neumann", 4, "Bauleiterin"], ["Max", "Vogel", 5, "Einkauf"],
] as const;

// стадии доски по умолчанию: New Lead, Contacted, Qualified, Proposal, Negotiation, Won
const DEALS: [string, number, number][] = [
    ["Lagerlogistik-Software", 0, 0], ["Beratung Q4", 0, 1], ["Wartungsvertrag", 1, 2], ["Webshop-Relaunch", 1, 3],
    ["Maschinenpark Erweiterung", 2, 4], ["ERP-Anbindung", 2, 5], ["Schulung Team", 3, 6], ["Jahreslizenz 25 Nutzer", 3, 7],
    ["Fuhrpark-Tracking", 4, 8], ["Rahmenvertrag Material", 4, 9], ["Umbau Showroom", 5, 10], ["Cloud-Migration", 5, 11],
    ["Support-Paket Premium", 2, 0], ["Messestand-Planung", 1, 4],
];

const PRODUCTS: { name: string; sku: string; type: "good" | "service"; unit: string; buy: number; sell: number; qty: number; reorder: number }[] = [
    { name: "Netzwerkkabel Cat.6, 305 m", sku: "ART-0001", type: "good", unit: "Rolle", buy: 86, sell: 129, qty: 12, reorder: 5 },
    { name: "Patchkabel 2 m", sku: "ART-0002", type: "good", unit: "Stk", buy: 1.8, sell: 4.9, qty: 180, reorder: 60 },
    { name: "Switch 24 Port", sku: "ART-0003", type: "good", unit: "Stk", buy: 210, sell: 329, qty: 7, reorder: 4 },
    { name: "WLAN-Access-Point", sku: "ART-0004", type: "good", unit: "Stk", buy: 96, sell: 159, qty: 3, reorder: 5 },
    { name: "USV 1500 VA", sku: "ART-0005", type: "good", unit: "Stk", buy: 240, sell: 389, qty: 4, reorder: 2 },
    { name: "Serverschrank 42U", sku: "ART-0006", type: "good", unit: "Stk", buy: 520, sell: 790, qty: 2, reorder: 1 },
    { name: "Netzwerk-Router", sku: "ART-0007", type: "good", unit: "Stk", buy: 74, sell: 119, qty: 23, reorder: 8 },
    { name: "SSD 1 TB", sku: "ART-0008", type: "good", unit: "Stk", buy: 58, sell: 94, qty: 37, reorder: 10 },
    { name: "Bildschirm 27 Zoll", sku: "ART-0009", type: "good", unit: "Stk", buy: 139, sell: 219, qty: 0, reorder: 5 },
    { name: "Dockingstation", sku: "ART-0010", type: "good", unit: "Stk", buy: 88, sell: 139, qty: 15, reorder: 6 },
    { name: "Beratung (Stunde)", sku: "DL-001", type: "service", unit: "h", buy: 0, sell: 120, qty: 0, reorder: 0 },
    { name: "Installation vor Ort", sku: "DL-002", type: "service", unit: "Pausch.", buy: 0, sell: 390, qty: 0, reorder: 0 },
    { name: "Wartungsvertrag (Monat)", sku: "DL-003", type: "service", unit: "Monat", buy: 0, sell: 149, qty: 0, reorder: 0 },
    { name: "Schulung (Tag)", sku: "DL-004", type: "service", unit: "Tag", buy: 0, sell: 890, qty: 0, reorder: 0 },
];

const VENDORS = ["Büro Express", "Telekom", "Miete Büro", "Google Workspace", "Amazon Business", "Werbung Meta", "Steuerberater", "Dienstwagen Leasing"];
const CATEGORIES = ["office", "software", "rent", "marketing", "travel", "services"];

export async function seedDemoOrg(org: string, ownerName: string, locale: "ua" | "en" | "de" = "de", now = new Date()): Promise<void> {
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth() + 1;

    // ── реквизиты фирмы ──
    await prisma.financeSettings.upsert({
        where: { org },
        update: {},
        create: {
            org, country: "DE", currency: "EUR", legalName: "Demo Technik GmbH", address: "Musterstraße 1, 10115 Berlin", taxId: "DE123456789", vatId: "DE123456789", phone: "+49 30 1234567",
            email: "info@demo-technik.example", website: "www.demo-technik.example", registerNumber: "HRB 123456 B", managingDirector: ownerName, iban: "DE89370400440532013000", bic: "COBADEFFXXX",
            paymentTermsDays: 14, invoicePrefix: "RE", counters: {} as never,
        },
    });

    // ── клиенты ──
    const companies = [] as { id: string; name: string }[];
    for (const c of COMPANIES) {
        const row = await prisma.company.create({ data: { owner: org, name: c.name, field: c.field, address: c.address, status: "active", email: `office@${c.name.toLowerCase().replace(/[^a-z]/g, "")}.example`, paymentDays: 14, activities: [] as never } });
        companies.push({ id: row.id, name: row.name });
    }
    const contacts = [] as { id: string; name: string; company: string }[];
    for (const [first, last, ci, position] of PEOPLE) {
        const co = companies[ci];
        const row = await prisma.contact.create({
            data: { owner: org, name: `${first} ${last}`, firstName: first, lastName: last, email: `${first}.${last}@${co.name.toLowerCase().replace(/[^a-z]/g, "")}.example`.toLowerCase(), phone: `+49 151 ${String(2000000 + ci * 111111 + position.length * 13).slice(0, 7)}`, company: co.name, companyId: co.id, position, source: ci % 2 ? "website" : "referral", activities: [] as never },
        });
        contacts.push({ id: row.id, name: row.name, company: co.name });
    }

    // ── сделки по этапам ──
    const stages = (await ensureStages(org), await prisma.stage.findMany({ where: { owner: org }, orderBy: { order: "asc" } }));
    const perStage = new Map<string, number>();
    for (const [title, si, pi] of DEALS) {
        const stage = stages[Math.min(si, stages.length - 1)];
        const contact = contacts[pi % contacts.length];
        const idx = perStage.get(stage.id) ?? 0;
        perStage.set(stage.id, idx + 1);
        await prisma.deal.create({
            data: {
                owner: org, stage: stage.id, clientName: `${contact.company} — ${title}`, order: idx, contactName: contact.name, companyName: contact.company, contact: contact.id,
                startDate: ymd(addDays(today, -(10 + pi * 3))), endDate: ymd(addDays(today, 20 + pi * 2)), dealType: pi % 2 ? "service" : "product", responsible: ownerName, source: pi % 3 ? "website" : "referral",
                wonAt: si === 5 ? addDays(today, -(3 + pi)) : null, activities: [] as never,
            },
        });
    }

    // ── задачи и проекты ──
    const TASKS: [string, number, boolean][] = [
        ["Angebot an Nordlicht AG senden", 1, false], ["Rechnung RE-2026 prüfen und versenden", 0, false], ["Kunden Berger zurückrufen", 2, false], ["Lagerbestand Switches prüfen", 3, false],
        ["Messestand-Material bestellen", 5, false], ["Vertrag Weber & Söhne unterschreiben lassen", -1, false], ["Newsletter-Entwurf freigeben", 4, false], ["Jahresabschluss-Unterlagen sammeln", 9, false],
        ["Support-Ticket 4711 beantworten", -2, true], ["Neue Kontakte aus Messe importieren", -3, true],
    ];
    for (const [title, plus, done] of TASKS) {
        await prisma.task.create({ data: { owner: org, title, description: "", deadline: `${ymd(addDays(today, plus))}T${pad(9 + (title.length % 8))}:00`, responsible: ownerName, createdBy: ownerName, completed: done, activities: [] as never } });
    }
    for (const [name, status, color] of [["Website-Relaunch", "active", "#2DDEB6"], ["Lager-Umzug", "planned", "#F4A100"], ["ERP-Einführung", "active", "#5EA8F5"]] as const) {
        await prisma.project.create({ data: { owner: org, name, description: "", status, startDate: ymd(addDays(today, -20)), endDate: ymd(addDays(today, 60)), responsible: ownerName, color, createdByName: ownerName } });
    }

    // ── команда и календарь ──
    for (const [first, last, position, department] of [["Anna", "Link", "Vertrieb", "Sales"], ["Maria", "Weber", "Buchhaltung", "Finance"], ["Tom", "Klein", "Lager", "Logistik"], ["Sven", "Maurer", "Support", "Service"]] as const) {
        await prisma.employee.create({ data: { owner: org, firstname: first, lastname: last, email: `${first}.${last}@demo-technik.example`.toLowerCase(), position, department } });
    }
    const EVENTS: [string, number, string, string][] = [["Team-Meeting", 0, "09:30", "10:00"], ["Kundentermin Nordlicht AG", 1, "14:00", "15:00"], ["Lieferantengespräch", 2, "11:00", "11:45"], ["Produktdemo für Berger", 3, "10:00", "11:00"], ["Quartalsplanung", 6, "13:00", "15:00"], ["Messe-Briefing", 8, "16:00", "16:30"]];
    for (const [title, plus, start, end] of EVENTS) {
        await prisma.event.create({ data: { org, title, date: ymd(addDays(today, plus)), startTime: start, endDate: ymd(addDays(today, plus)), endTime: end, color: "#c6ff4d", createdByName: ownerName, calendar: "my" } });
    }

    // ── склад: два склада, товары, движения ──
    const main = await prisma.warehouse.create({ data: { org, name: "Hauptlager", kind: "warehouse", address: "Musterstraße 1, Berlin", isDefault: true } });
    await prisma.warehouse.create({ data: { org, name: "Außenlager", kind: "warehouse", address: "Gewerbepark 8, Potsdam" } });
    const products = [] as { id: string; name: string; sell: number; sku: string; type: string; unit: string }[];
    for (const p of PRODUCTS) {
        const row = await prisma.product.create({ data: { org, name: p.name, sku: p.sku, type: p.type, unit: p.unit, purchasePrice: p.buy, salePrice: p.sell, taxRate: 19, stockQty: p.qty, reorderLevel: p.reorder } });
        products.push({ id: row.id, name: p.name, sell: p.sell, sku: p.sku, type: p.type, unit: p.unit });
        if (p.type === "good" && p.qty > 0) {
            await prisma.stockMovement.create({ data: { org, product: row.id, qty: p.qty, reason: "purchase", warehouse: main.id, unitCost: p.buy, note: "Wareneingang", by: ownerName } });
        }
    }
    for (const s of [["Netzwerk Großhandel GmbH", "Dieter Roth", 14], ["Büro & Technik Nord", "Karin Vogt", 30], ["Serverparts24", "Ahmet Yilmaz", 7]] as const) {
        await prisma.supplier.create({ data: { org, name: s[0], contactName: s[1], email: `vertrieb@${s[0].toLowerCase().replace(/[^a-z]/g, "")}.example`, paymentDays: s[2], currency: "EUR", address: "Deutschland" } });
    }

    // ── счета, заказы, предложения, расходы ──
    const goods = products.filter((p) => p.type === "good");
    const services = products.filter((p) => p.type === "service");
    const line = (p: { name: string; sell: number }, qty: number) => ({ description: p.name, qty, unitPrice: p.sell, taxRate: 19 });
    const gross = (items: { qty: number; unitPrice: number; taxRate: number }[]) => money(items.reduce((s, i) => s + i.qty * i.unitPrice * (1 + i.taxRate / 100), 0));
    let seq = 0;
    const invoiceNo = () => `RE-${year}-${String(++seq).padStart(4, "0")}`;
    const customers = companies;
    // оплаченные — по три-четыре в каждый месяц с января
    for (let m = 1; m <= month; m++) {
        const days = m === month ? Math.max(1, today.getUTCDate() - 1) : 27;
        for (let k = 0; k < 4; k++) {
            const day = Math.max(1, Math.min(days, 3 + k * 6));
            const c = customers[(m + k) % customers.length];
            const items = k % 2 ? [line(services[(m + k) % services.length], 1 + (k % 3)), line(goods[(m * 2 + k) % goods.length], 1 + k)] : [line(goods[(m + k * 3) % goods.length], 2 + k), line(services[0], 2 + m % 3)];
            const issue = new Date(Date.UTC(year, m - 1, day));
            const paidAt = addDays(issue, 6 + k);
            await prisma.invoice.create({
                data: {
                    org, number: invoiceNo(), kind: "invoice", customerName: c.name, customerAddress: COMPANIES.find((x) => x.name === c.name)?.address ?? "", company: c.id, items: items as never, currency: "EUR", issueDate: ymd(issue), dueDate: ymd(addDays(issue, 14)),
                    supplyDate: ymd(issue), status: "paid", sentAt: issue, paidAt: paidAt > today ? addDays(today, -1) : paidAt, paidAmount: gross(items), createdByName: ownerName,
                },
            });
        }
    }
    const open: [string, number, number, string][] = [["sent", -5, 9, ""], ["sent", -2, 12, ""], ["sent", -1, 13, ""], ["overdue", -34, -20, "Zahlungserinnerung"], ["overdue", -48, -34, "Zahlungserinnerung"], ["draft", 0, 14, ""], ["draft", 0, 14, ""]];
    for (let i = 0; i < open.length; i++) {
        const [status, issueOffset, dueOffset] = open[i];
        const c = customers[(i * 2 + 1) % customers.length];
        const items = [line(goods[(i + 2) % goods.length], 2 + (i % 4)), line(services[(i + 1) % services.length], 1)];
        const issue = addDays(today, issueOffset);
        await prisma.invoice.create({
            data: {
                org, number: invoiceNo(), kind: "invoice", customerName: c.name, customerAddress: COMPANIES.find((x) => x.name === c.name)?.address ?? "", company: c.id, items: items as never, currency: "EUR", issueDate: ymd(issue), dueDate: ymd(addDays(today, dueOffset)),
                supplyDate: ymd(issue), status, sentAt: status === "draft" ? null : issue, reminderCount: status === "overdue" ? 1 : 0, dunningLevel: status === "overdue" ? 1 : 0, createdByName: ownerName,
            },
        });
    }
    await prisma.financeSettings.update({ where: { org }, data: { counters: { [`RE-${year}`]: seq } as never } });

    const ORDER_ST = ["draft", "confirmed", "confirmed", "fulfilled", "invoiced", "closed"];
    for (let i = 0; i < 6; i++) {
        const c = customers[i % customers.length];
        const items = [line(goods[(i * 3) % goods.length], 3 + i), line(services[2], 1)];
        await prisma.order.create({ data: { org, number: `AU-${year}-${String(i + 1).padStart(4, "0")}`, company: c.id, customerName: c.name, items: items as never, currency: "EUR", status: ORDER_ST[i], responsible: ownerName, createdByName: ownerName } });
    }
    const QUOTE_ST = ["sent", "sent", "accepted", "draft"];
    for (let i = 0; i < 4; i++) {
        const c = customers[(i + 2) % customers.length];
        const items = [line(goods[(i * 2 + 1) % goods.length], 2 + i), line(services[1], 1)];
        await prisma.quote.create({ data: { org, number: `AN-${year}-${String(i + 1).padStart(4, "0")}`, company: c.id, customerName: c.name, items: items as never, currency: "EUR", issueDate: ymd(addDays(today, -(4 + i * 3))), validUntil: ymd(addDays(today, 14 + i)), status: QUOTE_ST[i], createdByName: ownerName } });
    }
    for (let m = 1; m <= month; m++) {
        for (let k = 0; k < 4; k++) {
            const vendor = VENDORS[(m + k * 2) % VENDORS.length];
            const base = [420, 89, 1450, 36, 240, 310, 520, 780][(m + k * 2) % 8];
            await prisma.expense.create({ data: { org, vendor, category: CATEGORIES[(m + k) % CATEGORIES.length], amount: base + (m * 7 + k * 11) % 40, currency: "EUR", taxRate: 19, date: `${year}-${pad(m)}-${pad(Math.min(27, 2 + k * 7))}`, createdByName: ownerName } });
        }
    }

    // ── роботы в офисе: стартовый состав и несколько поручений с готовыми ответами ──
    await ensureStarters(org);
    const robots = await listRobots(org);
    const by = (tpl: string) => robots.find((r) => r.template === tpl);
    type Scene = [string, string, string, "done" | "waiting", number];
    const SCENES: Record<string, Scene[]> = {
        ua: [
            ["accounting", "Підведи підсумки місяця: виручка, витрати та відкриті суми.", "Виручка за місяць — 18 740,00 €, витрати — 3 210,00 €, прибуток — 15 530,00 €. Відкрито 3 рахунки на 4 905,00 €, 2 з них прострочені (3 120,00 €).", "done", 40],
            ["warehouse", "Що закінчується на складі?", "Нижче мінімуму 3 позиції: «Bildschirm 27 Zoll» (0 шт.), «WLAN-Access-Point» (3 при мінімумі 5), «USV 1500 VA» (4). Пропоную докупити 10, 8 і 4 шт.", "done", 90],
            ["sales", "Знайди клієнтів, з якими давно не спілкувались, і створи завдання на дзвінок.", "Знайшла 2 клієнтів без контакту понад 30 днів. Підготувала завдання на дзвінок — підтвердьте, і вони з’являться в завданнях.", "waiting", 15],
        ],
        en: [
            ["accounting", "Sum up the month: revenue, expenses and open amounts.", "Revenue this month: €18,740.00, expenses: €3,210.00, profit: €15,530.00. 3 invoices are open (€4,905.00), 2 of them overdue (€3,120.00).", "done", 40],
            ["warehouse", "What is running out in the warehouse?", "3 items are below the minimum: “Bildschirm 27 Zoll” (0), “WLAN-Access-Point” (3 of 5), “USV 1500 VA” (4). I suggest ordering 10, 8 and 4 pieces.", "done", 90],
            ["sales", "Find customers we have not talked to for a while and create call tasks.", "Found 2 customers without contact for over 30 days. The call tasks are ready — confirm and they appear in your tasks.", "waiting", 15],
        ],
        de: [
            ["accounting", "Fasse den Monat zusammen: Umsatz, Ausgaben und offene Beträge.", "Umsatz im Monat: 18.740,00 €, Ausgaben: 3.210,00 €, Gewinn: 15.530,00 €. 3 Rechnungen sind offen (4.905,00 €), 2 davon überfällig (3.120,00 €).", "done", 40],
            ["warehouse", "Was geht im Lager zur Neige?", "3 Artikel unter Mindestbestand: „Bildschirm 27 Zoll“ (0), „WLAN-Access-Point“ (3 von 5), „USV 1500 VA“ (4). Ich empfehle, 10, 8 und 4 Stück nachzubestellen.", "done", 90],
            ["sales", "Finde Kunden ohne Kontakt seit längerer Zeit und lege Anruf-Aufgaben an.", "2 Kunden ohne Kontakt seit über 30 Tagen gefunden. Die Anruf-Aufgaben sind vorbereitet — bestätigen Sie, dann erscheinen sie in Ihren Aufgaben.", "waiting", 15],
        ],
    };
    for (const [tpl, text, reply, status, ago] of SCENES[locale] ?? SCENES.de) {
        const r = by(tpl);
        if (!r) continue;
        const t = await createTask(org, { robot: r.id, robotName: r.name, text, source: "user", locale });
        const at = new Date(now.getTime() - ago * 60000).toISOString();
        await updateTask(org, t.id, {
            status, reply, createdAt: at, startedAt: at, ...(status === "done" ? { finishedAt: at } : {}),
            ...(status === "waiting" ? { pending: [{ id: "demo-a1", tool: "create_task", args: { title: "Anruf Berger Handel", deadline: ymd(addDays(today, 1)) }, target: "Anruf Berger Handel" }, { id: "demo-a2", tool: "create_task", args: { title: "Anruf Weber & Söhne", deadline: ymd(addDays(today, 1)) }, target: "Anruf Weber & Söhne" }] } : {}),
        });
    }
}
