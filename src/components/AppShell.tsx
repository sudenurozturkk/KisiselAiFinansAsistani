"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";
import QuickAddFAB from "@/components/QuickAddFAB";
import AuthGuard from "@/components/AuthGuard";

/** Sidebar/FAB gösterilmeyecek sayfalar */
const FULL_SCREEN_PATHS = ["/landing", "/auth"];

/**
 * Uygulama kabuğu — sayfa yoluna göre:
 *   • Landing/Auth → tam ekran, sidebar yok
 *   • Diğer sayfalar → sidebar + FAB + toast
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullScreen = FULL_SCREEN_PATHS.some((p) => pathname.startsWith(p));

  if (isFullScreen) {
    return (
      <ToastProvider>
        <AuthGuard>{children}</AuthGuard>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <AuthGuard>
        <div className="min-h-screen flex">
          <Sidebar />
          <main className="flex-1 p-4 pb-24 md:p-6 md:pb-10 lg:p-10 max-w-7xl mx-auto w-full">
            {children}
          </main>
        </div>
        <QuickAddFAB />
      </AuthGuard>
    </ToastProvider>
  );
}
