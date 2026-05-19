"use client";
import { Trophy, Lock } from "lucide-react";
import type { Achievement } from "@/lib/achievements";

const TIER_STYLES: Record<
  Achievement["tier"],
  { ring: string; bg: string; text: string; badge: string; label: string }
> = {
  bronze: {
    ring: "ring-amber-300",
    bg: "bg-amber-50",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-700",
    label: "Bronz",
  },
  silver: {
    ring: "ring-slate-300",
    bg: "bg-slate-50",
    text: "text-slate-700",
    badge: "bg-slate-200 text-slate-700",
    label: "Gümüş",
  },
  gold: {
    ring: "ring-yellow-400",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    badge: "bg-yellow-100 text-yellow-700",
    label: "Altın",
  },
};

export default function AchievementsPanel({
  achievements,
  compact = false,
}: {
  achievements: Achievement[];
  compact?: boolean;
}) {
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <section className="card space-y-3 h-full" aria-label="Başarılar">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="text-amber-500" size={18} aria-hidden="true" />
          <h3 className="font-semibold text-sm">Başarılar</h3>
        </div>
        <span className="text-xs text-slate-500" aria-live="polite">
          {unlockedCount}/{achievements.length} kazanıldı
        </span>
      </div>

      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
        {achievements.map((a) => (
          <AchievementCard key={a.id} achievement={a} compact={compact} />
        ))}
      </div>
    </section>
  );
}

function AchievementCard({
  achievement,
  compact,
}: {
  achievement: Achievement;
  compact: boolean;
}) {
  const style = TIER_STYLES[achievement.tier];
  const unlocked = achievement.unlocked;

  return (
    <div
      className={`relative rounded-xl border p-3 transition-all ${
        unlocked
          ? `${style.bg} border-transparent ring-1 ${style.ring}`
          : "bg-slate-50 border-slate-200 opacity-60"
      }`}
    >
      {/* Kilit ikonu — sağ üst */}
      {!unlocked && (
        <Lock
          size={10}
          className="absolute top-2 right-2 text-slate-400"
          aria-hidden="true"
        />
      )}

      {/* Emoji + içerik */}
      <div className="flex flex-col gap-1.5">
        <span className="text-2xl leading-none" role="img" aria-label={achievement.title}>
          {unlocked ? achievement.icon : "🔒"}
        </span>

        {/* Başlık — tüm metin, truncate yok */}
        <div className="text-[11px] font-semibold leading-snug text-slate-800">
          {achievement.title}
        </div>

        {/* Açıklama — compact modda kısaltılmaz */}
        {!compact && (
          <div className="text-[10px] text-slate-500 leading-relaxed">
            {achievement.description}
          </div>
        )}

        {/* Alt kısım: tier badge veya progress */}
        {unlocked ? (
          <span className={`self-start text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full ${style.badge}`}>
            {style.label}
          </span>
        ) : (
          <div className="space-y-0.5">
            <div className="h-1 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all"
                style={{ width: `${achievement.progress}%` }}
              />
            </div>
            <div className="text-[9px] text-slate-400">
              %{achievement.progress} tamamlandı
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
