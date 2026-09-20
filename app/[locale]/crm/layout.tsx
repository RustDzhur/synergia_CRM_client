"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Toaster } from "react-hot-toast";
import { Header, ModalNavigation, Sidebar } from "@/components/crm";
import MobilePageBar from "@/components/crm/components/Header/components/MobilePageBar";
import ProfileModal from "@/components/crm/components/Header/components/ProfileModal";
import useAuthStore from "@/app/store/useAuthStore";
import Loader from "@/app/utils/Loader";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, authChecked, checkAuth } = useAuthStore();
    const router = useRouter();
    const locale = useLocale();

    useEffect(() => { checkAuth(); }, [checkAuth]);
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

    return (
        <>
            {/* Шапка из Figma: 82px на телефоне, 110px на планшете и desktop */}
            <header className="bg-headerBackground">
                <div className="flex items-center h-[82px] md:h-[110px] px-16 md:px-24 lg:px-32 lg:max-w-screen-lg m-auto">
                    <Header />
                </div>
            </header>
            <MobilePageBar />
            <div className="flex lg:max-w-screen-lg m-auto min-h-[calc(100vh-82px)] md:min-h-[calc(100vh-110px)]">
                <Sidebar />
                <main className="flex-1 min-w-0 bg-white">{children}</main>
            </div>
            <ModalNavigation />
            <ProfileModal />
            <Toaster />
        </>
    );
}
