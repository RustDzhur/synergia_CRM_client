import type { Metadata } from "next";
import PartnerLanding from "@/components/partner/PartnerLanding";

// Страница банка-партнёра: ссылка с кодом, не для поисковиков
export const metadata: Metadata = { title: "Firmspace AI", robots: { index: false, follow: false } };

export default function PartnerPage({ params }: { params: { code: string } }) {
    return <PartnerLanding code={params.code} />;
}
