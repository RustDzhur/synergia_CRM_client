import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { mailboxCanSend, sendRaw } from "@/lib/mail";

// Системные письма платформы (коды подтверждения почты). Отправитель — сама платформа, двумя способами по порядку:
// 1) свой SMTP-сервер из переменных окружения SMTP_HOST, SMTP_PORT (587 по умолчанию), SMTP_USER, SMTP_PASS, SMTP_FROM;
// 2) ящик платформы, подключённый в CRM (Настройки → Почта): адрес PLATFORM_MAIL (по умолчанию firmspacede@gmail.com), статус «подключён».
//    Gmail не различает точки в адресе, поэтому firmspace.de@gmail.com и firmspacede@gmail.com — один ящик.
const smtpConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const norm = (email: string) => {
    const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
    return /^(gmail|googlemail)\.com$/.test(domain) ? `${local.replace(/\./g, "").split("+")[0]}@gmail.com` : `${local}@${domain}`;
};

async function platformMailbox() {
    const want = norm(process.env.PLATFORM_MAIL || "firmspacede@gmail.com");
    const boxes = await prisma.integration.findMany({ where: { type: "mail", status: "connected" } });
    return boxes.find((b) => norm(String((b.config as { email?: string } | null)?.email ?? "")) === want && mailboxCanSend(b)) ?? null;
}

export async function mailConfigured(): Promise<boolean> {
    return smtpConfigured() || !!(await platformMailbox());
}

export async function sendSystemMail(to: string, subject: string, text: string): Promise<void> {
    if (smtpConfigured()) {
        const port = Number(process.env.SMTP_PORT || 587);
        const transport = nodemailer.createTransport({
            host: process.env.SMTP_HOST, port, secure: port === 465,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
            connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
        });
        await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text });
        return;
    }
    const box = await platformMailbox();
    if (!box) throw new Error("No mailbox for system e-mails is configured");
    await sendRaw(box, { to, subject, text });
}
