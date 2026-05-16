"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isLoggedIn } from "@/lib/userId";

/** Auth gerektirmeyen sayfalar */
const PUBLIC_PATHS = ["/landing", "/auth"];

/**
 * Kullanıcı oturum kontrolü yapan guard bileşeni.
 * - Giriş yapmamışsa → /landing'e yönlendirir
 * - Giriş yapmışsa → çocuk bileşenleri render eder
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    const loggedIn = isLoggedIn();

    if (!loggedIn && !isPublic) {
      router.replace("/landing");
      return;
    }

    if (loggedIn && isPublic) {
      router.replace("/dashboard");
      return;
    }

    setReady(true);
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-500">Yükleniyor...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
