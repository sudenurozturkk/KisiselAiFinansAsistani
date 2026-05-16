"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  User,
  MessageSquare,
  Sparkles,
  Wallet,
  Brain,
  CreditCard,
  Target,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { Avatar, Skeleton } from "./ui";
import { api } from "@/lib/api";
import { clearSession, getUserName, isDemoAccount } from "@/lib/userId";
import type { UserProfile } from "@/lib/types";

/* ─── Navigasyon Öğeleri ────────────────────────────────────── */

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "İstek Listesi", icon: ShoppingBag },
  { href: "/recommendations", label: "Öneriler", icon: Sparkles },
  { href: "/simulator", label: "Senaryo", icon: Target },
  { href: "/subscriptions", label: "Abonelikler", icon: CreditCard },
  { href: "/chat", label: "AI Sohbet", icon: MessageSquare },
  { href: "/literacy", label: "Okuryazarlık", icon: Brain },
  { href: "/profile", label: "Profil", icon: User },
];

/* ─── Sidebar Component ────────────────────────────────────── */

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getUser()
      .then((r) => alive && setUser(r.user))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function handleLogout() {
    clearSession();
    router.push("/landing");
  }

  const displayName = user?.name || getUserName();
  const isDemo = isDemoAccount();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="w-64 shrink-0 hidden md:flex flex-col border-r border-slate-200 bg-white/70 backdrop-blur-md sticky top-0 h-screen">
        {/* Logo */}
        <div className="px-6 py-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-brand-600 text-white grid place-items-center shadow-soft">
            <Wallet size={18} />
          </div>
          <div>
            <div className="font-semibold leading-tight">Akıllı Finans</div>
            <div className="text-xs text-slate-500">AI Asistan Platformu</div>
          </div>
        </div>

        {/* User Card */}
        <div className="px-4 py-4 border-b border-slate-100">
          {user ? (
            <Link href="/profile" className="flex items-center gap-3 group">
              <Avatar name={displayName} size={40} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate group-hover:text-brand-700">
                  {displayName}
                </div>
                <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                  {isDemo && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[9px] font-semibold">
                      DEMO
                    </span>
                  )}
                  Bütçe:{" "}
                  {Math.round(user.monthlyBudget).toLocaleString("tr-TR")}₺
                </div>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-16" />
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="p-3 flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                  active
                    ? "bg-brand-50 text-brand-700 font-medium"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 space-y-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition"
          >
            <LogOut size={16} />
            Çıkış Yap
          </button>
          <div className="text-[11px] text-slate-400">
            <div>Gemini AI • Agentic Finance Assistant</div>
            <div className="mt-0.5">Hackathon 2026 🚀</div>
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Ana navigasyon"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_-12px_rgba(0,0,0,0.1)]"
      >
        <div
          className="flex overflow-x-auto no-scrollbar"
          style={{ scrollbarWidth: "none" }}
        >
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center py-2.5 px-3 text-[10px] gap-0.5 min-w-[68px] flex-1 transition ${
                  active
                    ? "text-brand-700 bg-brand-50/60"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="truncate max-w-full">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
