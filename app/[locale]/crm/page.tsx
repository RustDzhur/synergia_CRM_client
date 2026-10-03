import Dashboard from "@/components/crm/Dashboard";

// Кабинет не индексируем. Вложенные разделы закрыты заголовком X-Robots-Tag в next.config.js.
export { generateMetadata } from "./metadata";

export default function DashboardPage() {
	return <Dashboard />;
}
