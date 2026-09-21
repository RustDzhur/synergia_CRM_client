const HOUR = 3600_000;

// Какой этап дедлайна наступил: просрочено (не старше двух суток), меньше часа, меньше суток; иначе null
export function deadlineStage(at: number, now = Date.now()): "24h" | "1h" | "overdue" | null {
	const left = at - now;
	if (left <= 0) return left > -48 * HOUR ? "overdue" : null;
	if (left <= HOUR) return "1h";
	if (left <= 24 * HOUR) return "24h";
	return null;
}
