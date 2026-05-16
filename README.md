# Akıllı Finans Asistanı — AI Destekli Kişisel Finans Platformu

Kişisel finans yönetimi + akıllı alışveriş önerilerini birleştiren, **Gemini AI** destekli bir agentic finans asistanı platformu.

## ✨ Özellikler

### 🏠 Profesyonel Landing Page
- Gradient temali etkileyici tanıtım sayfası
- Özellik kartları ve nasıl çalışır bölümü
- Tek tıkla demo hesap ile deneyim

### 🔐 Giriş & Kayıt Sistemi
- Modern iki panelli auth arayüzü
- Kayıt olurken bütçe ve hedef bilgileri
- Demo hesap ile anında tüm özellikleri keşfetme
- Oturum yönetimi (localStorage tabanlı)

### 📊 Akıllı Dashboard
- Aylık gelir/gider özeti, net durum
- Finansal sağlık skoru (SVG gauge)
- Harcama anomali tespiti
- 30 günlük AI tahmin grafikleri
- Tasarruf hedefi ilerleme çubuğu
- Kategori bazlı harcama analizi (pasta + bar + çizgi grafik)

### 🛒 Akıllı İstek Listesi
- URL yapıştır → AI ürünü tanısın
- Otomatik fiyat takibi ve price history
- AI tabanlı satın alma önerisi (al / bekle / vazgeç / alternatif bul)
- Bütçeye uygunluk analizi

### 💬 Agentic AI Sohbet
- Gemini AI destekli kişisel finans danışmanı
- Tool calling ile gerçek veri analizi
- Bütçe analizi, tasarruf planı, anomali tespiti
- Harcama karşılaştırma ve trend analizi

### 🎯 Senaryo Simülatörü
- "Eğer şunu yapsam?" sorusuna anlık cevap
- Kategori bazlı harcama slider'ları
- Ek gelir / tek seferlik gider simülasyonu
- Hedef süre tahmini ve AI çıkarımlar

### 🧠 Finansal Okuryazarlık Koçu
- AI destekli interaktif dersler
- Quiz sistemi (kolay / orta / zor)
- Senaryo analizi (kredi, yatırım, bütçe)
- 6 farklı finans konusu

### 💳 Abonelik Yönetimi
- Düzenli abonelikleri takip etme
- Aylık/yıllık maliyet hesaplama
- Aktif/pasif durumu yönetimi

### 📄 Ek Özellikler
- **Fiş Tarama (Vision AI)**: Fotoğraftan fiş okuma
- **CSV İçe Aktarma**: Banka ekstresi yükleme
- **AI Finansal Rapor**: Detaylı markdown rapor
- **Başarımlar**: Gamification ile tasarruf motivasyonu
- **Hızlı İşlem (FAB)**: Tek tıkla gelir/gider ekleme

## 🛠 Teknoloji

| Katman | Teknoloji |
|--------|-----------|
| Framework | Next.js 14 (App Router) |
| Dil | TypeScript |
| Stil | TailwindCSS |
| Grafikler | Recharts |
| AI | @google/generative-ai (Gemini) |
| İkonlar | Lucide React |
| Test | Vitest |
| Veri | In-memory store |

## 🚀 Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Ortam değişkenlerini kopyala
cp .env.example .env.local
# Windows PowerShell:
# Copy-Item .env.example .env.local

# .env.local dosyasına GEMINI_API_KEY değerini gir

# Geliştirme sunucusunu başlat
npm run dev
```

Tarayıcıdan `http://localhost:3000` adresine git.

## 🔑 Ortam Değişkenleri

| Değişken | Açıklama | Zorunlu |
|----------|----------|---------|
| `GEMINI_API_KEY` | Google AI Studio API anahtarı | Hayır (mock fallback) |
| `GEMINI_MODEL` | Kullanılacak model (varsayılan: `gemini-2.0-flash`) | Hayır |

> **Not**: API anahtarı olmadan UI tamamen çalışır; Gemini gerektiren özellikler mock yanıt üretir.

## 📁 Mimari

```
src/
  app/
    page.tsx                  # Kök yönlendirme (landing veya dashboard)
    landing/page.tsx          # Tanıtım sayfası
    auth/page.tsx             # Giriş / kayıt / demo hesap
    dashboard/page.tsx        # Ana dashboard
    chat/page.tsx             # AI sohbet
    products/page.tsx         # Akıllı istek listesi
    recommendations/page.tsx  # AI önerileri
    simulator/page.tsx        # Senaryo simülatörü
    literacy/page.tsx         # Finansal okuryazarlık
    subscriptions/page.tsx    # Abonelik yönetimi
    profile/page.tsx          # Profil ve işlem yönetimi
    api/                      # API route'ları
  components/
    AppShell.tsx              # Koşullu layout (sidebar/auth)
    AuthGuard.tsx             # Oturum kontrolü guard
    Sidebar.tsx               # Ana navigasyon
    Charts.tsx                # Recharts grafikleri
    QuickAddFAB.tsx           # Hızlı işlem ekleme
    Toast.tsx                 # Bildirim sistemi
    ui.tsx                    # Modal, Avatar, Skeleton, Badge...
  lib/
    store.ts                  # In-memory veri deposu
    repo.ts                   # CRUD işlemleri + seed data
    gemini.ts                 # Gemini AI istemcisi + araçlar
    agents.ts                 # Agentic AI tool definitions
    finance.ts                # Finansal hesaplamalar
    forecast.ts               # Harcama tahmini
    achievements.ts           # Başarım sistemi
    anomaly.ts                # Anomali tespiti
    simulator.ts              # Senaryo simülasyonu
    scraper.ts                # Ürün bilgisi çekme
    validation.ts             # Veri doğrulama
    api.ts                    # İstemci fetch yardımcıları
    auth.ts                   # Sunucu tarafı user ID okuma
    userId.ts                 # İstemci oturum yönetimi
    types.ts                  # TypeScript tipleri
```

## 🎮 Demo Hesap

1. Uygulamayı açın → Landing page gösterilir
2. **"Demo Hesapla Dene"** butonuna tıklayın
3. Otomatik olarak:
   - 6 aylık işlem geçmişi yüklenir
   - İstek listesi öğeleri oluşturulur
   - Abonelikler eklenir
   - Dashboard'a yönlendirilirsiniz
4. Tüm AI özelliklerini deneyebilirsiniz

## 📝 Lisans

MIT © 2026 — Hackathon Projesi
