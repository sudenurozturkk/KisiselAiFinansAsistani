"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/userId";

/**
 * Kök sayfa — kullanıcı durumuna göre yönlendirme yapar:
 *   • Giriş yapmışsa → /dashboard
 *   • Giriş yapmamışsa → /landing
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    if (isLoggedIn()) {
      router.replace("/dashboard");
    } else {
      router.replace("/landing");
    }
  }, [router]);

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-500">Yönlendiriliyor...</span>
      </div>
    </div>
  );
}
