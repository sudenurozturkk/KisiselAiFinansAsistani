"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  type LucideIcon,
} from "lucide-react";
import { Avatar, Skeleton } from "./ui";
import { api } from "@/lib/api";
import type { UserProfile } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const items: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "İstek Listesi", icon: ShoppingBag },
  { href: "/recommendations", label: "Öneriler", icon: Sparkles },
  { href: "/subscriptions", label: "Abonelikler", icon: CreditCard },
  { href: "/chat", label: "AI Sohbet", icon: MessageSquare },
  { href: "/literacy", label: "Okuryazarlık", icon: Brain },
  { href: "/profile", label: "Profil", icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();
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

  return (
    <>
      {/* Desktop */}
      <aside className="w-64 shrink-0 hidden md:flex flex-col border-r border-slate-200 bg-white/70 backdrop-blur-md sticky top-0 h-screen">
        <div className="px-6 py-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-brand-600 text-white grid place-items-center shadow-soft">
            <Wallet size={18} />
          </div>
          <div>
            <div className="font-semibold leading-tight">Akıllı Finans</div>
            <div className="text-xs text-slate-500">AI Asistan Platformu</div>
          </div>
        </div>

        <div className="px-4 py-4 border-b border-slate-100">
          {user ? (
            <Link href="/profile" className="flex items-center gap-3 group">
              <Avatar name={user.name || "Misafir"} size={40} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate group-hover:text-brand-700">
                  {user.name}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
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

        <nav className="p-3 flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => {
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

        <div className="mt-auto p-4 text-[11px] text-slate-400 border-t border-slate-100">
          <div>Gemini AI • Agentic Finance Assistant</div>
          <div className="mt-0.5">Hackathon 2026 🚀</div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur-md border-t border-slate-200">
        <div className="grid grid-cols-6">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center py-2.5 text-[10px] gap-0.5 ${
                  active ? "text-brand-700" : "text-slate-500"
                }`}
              >
                <Icon size={18} />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
