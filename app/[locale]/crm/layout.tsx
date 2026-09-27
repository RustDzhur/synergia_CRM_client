"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Toaster } from "react-hot-toast";
import { Header, ModalNavigation, Sidebar } from "@/components/crm";
import MobilePageBar from "@/components/crm/components/Header/components/MobilePageBar";
import ProfileModal from "@/components/crm/components/Header/components/ProfileModal";
import NotificationCenter from "@/components/crm/components/shared/NotificationCenter";
import AiAssistant from "@/components/crm/components/AiAssistant";
import Softphone from "@/components/crm/components/Main/shared/Softphone";
import "@/app/[locale]/styles/crm-dark.css";
import useAuthStore from "@/app/store/useAuthStore";
import { useThemeStore } from "@/app/store/useThemeStore";
import { useActiveOrg, useFeature } from "@/app/store/useOrgStore";
import { featureForPage } from "@/lib/features";
import Upgrade from "@/components/crm/components/Main/Upgrade";
import Loader from "@/app/utils/Loader";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, authChecked, checkAuth } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();
    const activeOrg = useActiveOrg();
    // раздел, который открывает страница: если его нет в тарифе фирмы, вместо раздела показываем выбор тарифа
    const path = pathname?.startsWith(`/${locale}/`) ? pathname.slice(locale.length + 1) : pathname ?? "";
    const needed = featureForPage(path);
    const locked = !!needed && activeOrg?.features?.[needed] === false;
    const softphone = useFeature("channels");
    const aiAssistant = useFeature("aiAssistant");

    useEffect(() => { checkAuth(); }, [checkAuth]);
    useEffect(() => {
        useThemeStore.getState().init();
        return () => useThemeStore.getState().release();
    }, []);
    useEffect(() => {
        if (authChecked && !isAuthenticated) router.replace(`/${locale}`);
    }, [authChecked, isAuthenticated, router, locale]);

    if (!authChecked || !isAuthenticated) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader color="#5EA8F5" width="50" height="10" radius="9" />
            </div>
        );
    }

    // личную фирму заблокировал администратор платформы — работать нельзя, пока он не снимет блокировку
    if (activeOrg?.blocked) {
        return (
            <div className="bg-ink flex min-h-screen items-center justify-center p-24 text-center">
                <div className="fs-card max-w-[420px] p-24">
                    <h1 className="mb-10 text-18 font-semibold text-[#f1f4ee]">Firmspace AI</h1>
                    <p className="text-13 text-[#8c948b]">{locale === "de" ? "Dieses Konto wurde gesperrt. Bitte wenden Sie sich an den Support." : locale === "ua" ? "Цей акаунт заблоковано. Зверніться до підтримки." : "This account has been blocked. Please contact support."}</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Каркас кабинета: сайдбар во всю высоту слева, справа — закреплённая шапка и содержимое раздела.
                Прокручивается документ целиком (а не отдельная область), поэтому выпадающие списки и модальные окна
                ведут себя как раньше. */}
            <div className="flex min-h-screen bg-ink">
                <Sidebar />
                <div className="flex min-w-0 flex-1 flex-col">
                    {/* Шапка: 56px на телефоне, 64px от планшета */}
                    <header className="sticky top-0 z-40 border-b border-inkLine bg-[rgba(10,12,11,0.86)] backdrop-blur-md">
                        <div className="flex h-56 items-center px-16 md:h-64 md:px-24 lg:px-32">
                            <Header />
                        </div>
                    </header>
                    <MobilePageBar />
                    <main className="min-w-0 flex-1 pb-[80px]">{locked ? <Upgrade /> : children}</main>
                </div>
            </div>
            <ModalNavigation />
            <ProfileModal />
            {softphone && <Softphone />}
            {aiAssistant && <AiAssistant />}
            <NotificationCenter />
            <Toaster />
        </>
    );
}
