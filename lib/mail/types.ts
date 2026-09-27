// Письмо в общем виде: так его отдают и IMAP, и Gmail, и Outlook, а в базу пишет одна и та же функция
export interface Fetched {
    externalId: string;
    folder: "inbox" | "sent";
    from: string;
    to: string;
    subject: string;
    body: string;
    at: Date;
    read: boolean;
    starred: boolean;
    bulk?: boolean; // рассылка/автописьмо (List-Unsubscribe, Precedence: bulk, категория «Промоакции» и т.п.) — лидом не считается
}

// Вложение исходящего письма: счета и другие документы уходят клиенту файлом (см. lib/finance/send.ts).
// Один и тот же вид у Gmail, SMTP и Outlook — конвертацию в формат провайдера делает каждый из них.
export interface MailAttachment {
    filename: string;
    contentType: string;
    content: Buffer;
}
