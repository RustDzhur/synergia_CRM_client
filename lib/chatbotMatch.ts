import { CHATBOT_FAQ, type FaqEntry } from "@/app/content/chatbotFaq";
import { tx } from "@/app/content/i18n";

// Простой подбор ответа по ключевым словам — без обращения к языковой модели (осознанный выбор для публичного
// лендингового бота, см. app/content/chatbotFaq.ts). Каждая запись получает очки за каждое своё ключевое слово,
// найденное подстрокой в вопросе пользователя; побеждает запись с максимумом очков, если он не нулевой.
const norm = (s: string) => s.toLowerCase().trim();

export function matchFaq(query: string): FaqEntry | null {
    const q = norm(query);
    if (!q) return null;
    let best: FaqEntry | null = null;
    let bestScore = 0;
    for (const entry of CHATBOT_FAQ) {
        let score = 0;
        for (const kw of entry.keywords) {
            if (q.includes(norm(kw))) score += kw.length >= 4 ? 2 : 1; // длинные ключевые слова весят больше — меньше случайных совпадений
        }
        if (score > bestScore) {
            bestScore = score;
            best = entry;
        }
    }
    return bestScore > 0 ? best : null;
}

export function faqQuestion(entry: FaqEntry, locale: string) {
    return tx(entry.q, locale);
}
export function faqAnswer(entry: FaqEntry, locale: string) {
    return tx(entry.a, locale);
}
