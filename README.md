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
| Veri | In-memory + yerel disk (`data/db.json`) |

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
| `GEMINI_API_KEY` | Google AI Studio API anahtarı | **Evet (zorunlu)** |
| `GEMINI_MODEL` | Kullanılacak model (varsayılan: `gemini-2.5-flash`) | Hayır |
| `TWELVEDATA_API_KEY` | Piyasa fiyatları (opsiyonel) | Hayır |

> **Önemli**: Tüm AI özellikleri (sohbet, öneriler, vision, simülatör, rapor vb.) yalnızca **gerçek Gemini API** ile çalışır. `GEMINI_API_KEY` yoksa bu uçlar **503** döner; sahte/mock yanıt üretilmez. API yanıtlarında `aiSource: "gemini"` ve `poweredBy: "Google Gemini"` alanları bulunur.

## 💾 Demo veri depolama

Bu proje **hackathon / demo** amaçlıdır; kalıcı veritabanı (PostgreSQL, MongoDB vb.) kullanılmaz.

- Tüm kullanıcı verileri (işlemler, istek listesi, sohbet, abonelikler) sunucu tarafında **RAM + yerel dosya** ile tutulur.
- **Jüri / deneme:** Repoda hazır demo veri seti vardır → `data/db.json` (clone sonrası ek kurulum gerekmez).
- Sunucu yeniden başlatıldığında veriler diskten yüklenir.
- Oturum kimliği tarayıcıda `localStorage` ile saklanır (`x-user-id` header). Demo hesap ile giriş yapın veya landing’deki demo akışını kullanın.
- Yerelde yaptığınız değişiklikler `data/db.json` dosyasına yazılır; commit etmeden önce kişisel bilgi içermediğinden emin olun.
- **Üretim ortamına taşınmamalı** — gerçek finans verisi için uygun değildir.

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
    statements/page.tsx       # Harcamalar, ekstre analizi, içe aktarma
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
    store.ts                  # In-memory + data/db.json kalıcılık
    repo.ts                   # CRUD işlemleri + demo seed
    transaction-import.ts     # Ekstre/fiş içe aktarma normalizasyonu
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
