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
