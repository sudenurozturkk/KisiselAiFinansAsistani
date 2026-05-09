# Akıllı Finans Asistanı

Kişisel finans yönetimi + e-ticaret alışverişini birleştiren, **Gemini API** destekli bir asistan platformu.

## Özellikler
- **Dashboard**: Aylık gelir/gider, net, bütçe kullanımı; pasta + çizgi + bar grafikleri.
- **Ürünler**: Bütçeye göre uygunluk, taksit önerisi ve AI tabanlı satın alma tavsiyesi.
- **AI Sohbet**: Kullanıcının profili + harcamalarını system prompt'a enjekte ederek kişiselleştirilmiş yanıtlar (`/api/chat`).
- **Öneriler**: Tek tıkla bütçe + harcama analizi, taksit ve düşük riskli yatırım fikirleri.
- **Profil**: Bütçe, gelir, tasarruf hedefi, risk toleransı + manuel işlem girişi.
- **Konuşma geçmişi**: MongoDB'de saklanır (anahtar yoksa in-memory fallback).

## Teknoloji
Next.js 14 (App Router) • TypeScript • TailwindCSS • Recharts • Mongoose • `@google/generative-ai` • Lucide.

## Kurulum

```bash
npm install
cp .env.example .env.local   # Windows PowerShell: Copy-Item .env.example .env.local
# .env.local içine MONGODB_URI ve GEMINI_API_KEY değerlerini gir (opsiyonel — yoksa mock/in-memory)
npm run dev
```

Tarayıcıdan `http://localhost:3000` adresine git.

## Ortam Değişkenleri
- `MONGODB_URI` — Atlas/local Mongo bağlantı stringi. **Boş bırakılırsa in-memory store** kullanılır (sunucu yeniden başlayınca veriler sıfırlanır).
- `GEMINI_API_KEY` — Google AI Studio'dan alınır. **Boş bırakılırsa mock yanıtlar** üretilir; UI tamamen çalışır.
- `GEMINI_MODEL` — Varsayılan: `gemini-1.5-flash`.

## Mimari
```
src/
  app/
    page.tsx                  # Dashboard
    products/page.tsx
    profile/page.tsx
    chat/page.tsx
    recommendations/page.tsx
    api/
      user/route.ts
      transactions/route.ts
      products/route.ts
      chat/route.ts
      recommendations/route.ts
  components/                  # Sidebar, StatCard, Charts
  lib/
    db.ts            # Mongo lazy connect
    models.ts        # Mongoose şemaları
    store.ts         # In-memory fallback
    repo.ts          # Mongo + memory üstü tek arayüz
    gemini.ts        # Gemini istemcisi + system prompt + mock fallback
    finance.ts       # Özet/trend/pasta hesapları
    products.ts      # Ürün seed verisi
    api.ts           # Client fetch yardımcıları
    auth.ts          # Header'dan x-user-id okuma
    userId.ts        # localStorage demo kullanıcı ID'si
    types.ts
```

## Demo Auth
Bu sürümde gerçek auth yok: ilk açılışta `localStorage`'a rastgele bir `userId` yazılır ve tüm istekler `x-user-id` header'ı ile gönderilir. Üretim için NextAuth/JWT eklenebilir.

## Yol Haritası
- Gerçek auth (NextAuth — Google + email)
- Bütçe alarmları (Telegram/Email)
- CSV/banka hareket içe aktarma
- Mobil PWA + offline destek
- Çoklu dil (i18n)
