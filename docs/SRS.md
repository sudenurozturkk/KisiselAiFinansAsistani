# Akıllı Finans Asistanı — Yazılım Gereksinim Spesifikasyonu (SRS) ve Geliştirme Planı

> **Doküman Sürümü:** 1.0  
> **Son Güncelleme:** 2026-05-12  
> **Doküman Sahibi:** Ürün ve Mühendislik Ekibi  
> **Durum:** Aktif Geliştirme (Hackathon → Beta)

---

## İçindekiler

1. [Giriş](#1-giriş)
2. [Genel Açıklama](#2-genel-açıklama)
3. [Sistem Mimarisi](#3-sistem-mimarisi)
4. [Fonksiyonel Gereksinimler](#4-fonksiyonel-gereksinimler)
5. [Fonksiyonel Olmayan Gereksinimler](#5-fonksiyonel-olmayan-gereksinimler)
6. [Veri Modeli](#6-veri-modeli)
7. [API Spesifikasyonu](#7-api-spesifikasyonu)
8. [Kullanıcı Arayüzü Gereksinimleri](#8-kullanıcı-arayüzü-gereksinimleri)
9. [Güvenlik ve Gizlilik](#9-güvenlik-ve-gizlilik)
10. [Mevcut Durum Analizi (Gap Analysis)](#10-mevcut-durum-analizi-gap-analysis)
11. [Geliştirme Yol Haritası (Roadmap)](#11-geliştirme-yol-haritası-roadmap)
12. [Sprint Planı](#12-sprint-planı)
13. [Teknik Borç (Technical Debt)](#13-teknik-borç-technical-debt)
14. [Test Stratejisi](#14-test-stratejisi)
15. [Dağıtım (Deployment) Stratejisi](#15-dağıtım-deployment-stratejisi)
16. [İzleme ve Gözlemlenebilirlik](#16-izleme-ve-gözlemlenebilirlik)
17. [Risk Yönetimi](#17-risk-yönetimi)
18. [Kabul Kriterleri](#18-kabul-kriterleri)
19. [Sözlük (Glossary)](#19-sözlük-glossary)

---

## 1. Giriş

### 1.1 Amaç
Bu doküman; **Akıllı Finans Asistanı** uygulamasının yazılım gereksinimlerini, mimari kararlarını, mevcut durum analizini ve gelecek geliştirme planını profesyonel bir biçimde tanımlar. Hedef kitlesi: ürün yöneticileri, geliştiriciler, QA mühendisleri, tasarımcılar ve paydaşlardır.

### 1.2 Kapsam
Akıllı Finans Asistanı; bireysel kullanıcıların gelir-gider takibini yapan, AI tabanlı (Google Gemini) finansal tavsiyeler sunan, ürün satın alma kararlarını destekleyen, abonelik takibi yapan ve finansal okuryazarlık modülü sunan bir Next.js 14 web uygulamasıdır.

### 1.3 Hedefler
- Kullanıcının finansal sağlığını **anlık** olarak görselleştirmek.
- AI asistan ile **kişiselleştirilmiş** öneriler sunmak.
- Bütçe aşımı, anormal harcama, abonelik artışı gibi durumları **proaktif** olarak uyarmak.
- Demo mod ile API anahtarı olmadan tam deneyim sunmak.

### 1.4 Hedef Kitle
- 22-45 yaş arası bireysel kullanıcılar
- Finansal okuryazarlığını artırmak isteyen yeni mezunlar
- Bütçe disiplini kazanmak isteyen orta gelir grubu

### 1.5 Tanım, Kısaltmalar
| Kısaltma | Açıklama |
|---|---|
| SRS | Software Requirements Specification |
| LLM | Large Language Model (Gemini 1.5/2.0) |
| KPI | Key Performance Indicator |
| OCR | Optical Character Recognition |
| MTTR | Mean Time To Recovery |
| RBAC | Role-Based Access Control |

---

## 2. Genel Açıklama

### 2.1 Ürün Vizyonu
> "Türkiye'deki her bireyin cebinde, kendi mali müşaviri."

### 2.2 Ürün Konumlandırma
- **Tinder of finance**: Hızlı, eğlenceli, sezgisel.
- **AI-first**: Her özellik LLM destekli akıllı bir karar mekanizmasına sahip.
- **Privacy-first**: Veriler kullanıcının cihazında / kendi MongoDB'sinde kalır.

### 2.3 Kullanıcı Persona'ları

#### Persona 1: "Tasarrufçu Tunç" (28, Yazılımcı)
- Aylık gelir: 60.000 ₺
- İhtiyaç: Bütçe disiplini, yatırım önerisi.
- Sorun: Eğlence harcamaları kontrolden çıkıyor.

#### Persona 2: "Aileci Aylin" (35, Öğretmen)
- Aylık gelir: 45.000 ₺
- İhtiyaç: Aile bütçesi, market harcaması optimizasyonu.
- Sorun: Çoklu abonelik (Netflix, Spotify, Disney+) takibi.

#### Persona 3: "Yeni Mezun Yiğit" (23, Stajyer)
- Aylık gelir: 22.000 ₺
- İhtiyaç: Finansal okuryazarlık, ilk yatırım rehberi.
- Sorun: Para nereye gittiğini bilmiyor.

### 2.4 Genel Özellikler (Üst Düzey)
- Dashboard: Finansal sağlık özeti
- İşlem Yönetimi: CRUD + filtreleme + içe aktarma
- AI Sohbet: Bağlamsal finansal danışman
- Ürün Tavsiyesi: Bütçeye uygun alışveriş
- Abonelik Takibi: Otomatik tespit + iptal önerisi
- Finansal Okuryazarlık: Mikro öğrenme modülleri
- Anomali Tespiti: Sahte/dolandırıcılık koruması
- Fiş OCR (Vision): Mobil fotoğraftan işlem ekleme
- İstek Listesi: AI ile satın alma kararı analizi

### 2.5 Çalışma Ortamı
- **Tarayıcı**: Modern (Chrome 110+, Safari 16+, Firefox 110+, Edge 110+)
- **Cihaz**: Masaüstü (1280px+), Tablet (768-1280), Mobil (320-768)
- **Ağ**: 3G ve üzeri

---

## 3. Sistem Mimarisi

### 3.1 Yüksek Seviye Diyagram

```
┌──────────────────────────────────────────────────────────────┐
│                     Tarayıcı (Next.js Client)                │
│    React 18 · TailwindCSS · Recharts · Lucide · Toast        │
└──────────────────────────┬───────────────────────────────────┘
                           │ fetch (REST/JSON)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                Next.js 14 App Router (Edge/Node)             │
│  ┌──────────────┬──────────────┬──────────────────────────┐  │
│  │ /api/user    │ /api/chat    │ /api/recommendations     │  │
│  │ /api/tx      │ /api/wishlist│ /api/vision/receipt      │  │
│  │ /api/subs    │ /api/literacy│ /api/admin/reset         │  │
│  └──────────────┴──────────────┴──────────────────────────┘  │
└────────┬──────────────────┬──────────────────────────┬───────┘
         │                  │                          │
         ▼                  ▼                          ▼
   ┌──────────┐     ┌────────────────┐         ┌──────────────┐
   │ MongoDB  │     │ Google Gemini  │         │ Memory Store │
   │ (Mongoose│     │ 1.5 Flash/Pro  │         │  (fallback)  │
   │  / Atlas)│     │  + Vision API  │         │              │
   └──────────┘     └────────────────┘         └──────────────┘
```

### 3.2 Teknoloji Yığını

| Katman | Teknoloji | Sürüm | Amaç |
|---|---|---|---|
| Framework | Next.js | 14.2.15 | App Router, SSR, API Routes |
| UI | React | 18.3.1 | Bileşen modeli |
| Stil | TailwindCSS | 3.4.14 | Utility-first CSS |
| Tip | TypeScript | 5.6.3 | Statik tip güvenliği |
| Grafik | Recharts | 2.13.3 | Pie, Line, Bar |
| İkon | Lucide React | 0.460.0 | SVG ikon kütüphanesi |
| AI | @google/generative-ai | 0.21.0 | Gemini entegrasyonu |
| DB | Mongoose | 8.8.0 | MongoDB ORM |

### 3.3 Mimari Prensipler
- **Server-First**: Veri erişimi server-side; client sadece sunum.
- **Progressive Enhancement**: API/DB olmadan da memory store ile çalışır.
- **Type Safety**: `any` minimum; ortak tipler `src/lib/types.ts` içinde.
- **Single Source of Truth**: Finansal hesaplar `src/lib/finance.ts` içinde.
- **Stateless API**: Cookie tabanlı `userId` ile multi-user demo.

### 3.4 Klasör Yapısı

```
src/
├── app/
│   ├── api/                  # Backend route handler'lar
│   │   ├── user/
│   │   ├── transactions/
│   │   ├── chat/
│   │   ├── recommendations/
│   │   ├── subscriptions/
│   │   ├── wishlist/
│   │   ├── literacy/
│   │   ├── vision/receipt/
│   │   ├── import/
│   │   └── admin/reset/
│   ├── (sayfalar)            # Dashboard, Profile, Chat, Products vs.
│   ├── layout.tsx
│   └── globals.css
├── components/               # Yeniden kullanılabilir UI
│   ├── ui.tsx                # Modal, Badge, Skeleton, EmptyState
│   ├── Charts.tsx
│   ├── Toast.tsx
│   ├── Sidebar.tsx
│   ├── StatCard.tsx
│   ├── Insights.tsx
│   ├── BudgetAlert.tsx
│   └── Markdown.tsx
└── lib/
    ├── api.ts                # Client API wrapper
    ├── types.ts              # Ortak TypeScript tipleri
    ├── finance.ts            # Hesaplama yardımcıları
    ├── gemini.ts             # LLM istemcisi
    ├── repo.ts               # DB erişim katmanı
    ├── store.ts              # Memory fallback
    ├── anomaly.ts            # Anomali tespit motoru
    ├── agents.ts             # Multi-agent orchestrator
    ├── auth.ts               # Cookie tabanlı kimlik
    └── userId.ts             # User id resolver
```

---

## 4. Fonksiyonel Gereksinimler

### FR-01 Kullanıcı Profili Yönetimi
- **FR-01.1** Kullanıcı; isim, aylık gelir, aylık bütçe, tasarruf hedefi, risk toleransı, hedefler bilgilerini güncelleyebilmelidir.
- **FR-01.2** Profil değişiklikleri toast bildirimi ile teyit edilmelidir.
- **FR-01.3** Profil verisi kalıcı olarak (DB veya memory) saklanmalıdır.
- **FR-01.4** Form validasyonu: gelir/bütçe ≥ 0, hedef ≤ gelir.

### FR-02 İşlem (Transaction) Yönetimi
- **FR-02.1** Kullanıcı; gelir veya gider işlemi ekleyebilmelidir (tür, kategori, tutar, not, tarih).
- **FR-02.2** Kullanıcı işlemi düzenleyebilmelidir (modal üzerinden).
- **FR-02.3** Kullanıcı işlemi silebilmelidir (onay dialogu zorunlu).
- **FR-02.4** İşlemler tip ve kategoriye göre filtrelenebilmelidir.
- **FR-02.5** İşlemler tarihe göre azalan sıralanmalıdır.
- **FR-02.6** Toplam liste sayfalanabilir/sanal kaydırma destekli olmalıdır (≥ 100 işlemde).
- **FR-02.7** CSV içe aktarma desteklenmelidir (`/api/import`).
- **FR-02.8** Toplu silme desteklenmelidir.

### FR-03 Dashboard
- **FR-03.1** Bu ay gelir/gider/net görüntülenmelidir.
- **FR-03.2** Bütçe kullanım yüzdesi `ProgressBar` ile gösterilmelidir.
- **FR-03.3** %80'i aşan bütçe için `BudgetAlert` bileşeni gösterilmelidir.
- **FR-03.4** Kategori bazlı `SpendingPie` görüntülenmelidir.
- **FR-03.5** Son 6 ay `IncomeExpenseLine` trendi gösterilmelidir.
- **FR-03.6** Anomali tespit edilen işlemler için uyarı kartı görünmelidir.
- **FR-03.7** "Hızlı işlem ekle" CTA butonu olmalıdır.

### FR-04 AI Sohbet (Chat)
- **FR-04.1** Kullanıcı serbest metin sorabilmelidir.
- **FR-04.2** Asistan yanıtı **Markdown** formatında render edilmelidir.
- **FR-04.3** Yazıyor… göstergesi loading sırasında görünmelidir.
- **FR-04.4** Hata durumunda toast bildirimi gösterilmelidir.
- **FR-04.5** Geçmiş mesajlar saklanmalı, yeniden açıldığında yüklenmelidir.
- **FR-04.6** Kullanıcı geçmişi temizleyebilmelidir (onaylı).
- **FR-04.7** Hızlı aksiyon butonları olmalıdır (en az 4 öneri).
- **FR-04.8** AI yanıtları kullanıcının bağlam verisini (gelir, bütçe, son işlemler) kullanmalıdır.
- **FR-04.9** Stream (SSE) tabanlı yanıt opsiyonel olarak desteklenmelidir.

### FR-05 Ürün Tavsiyesi
- **FR-05.1** Ürün listesi resim, fiyat, taksit, rating ile gösterilmelidir.
- **FR-05.2** Bütçeye uygunluk algoritması her ürün için `affordableNow` döndürmelidir.
- **FR-05.3** Arama (isim, marka, kategori, etiket) desteklenmelidir.
- **FR-05.4** "Tümü / Bütçeye uygun / Esnek" filtreleri olmalıdır.
- **FR-05.5** Satın al modalı taksit seçimini sunmalı, AI değerlendirmesi göstermelidir.
- **FR-05.6** Satın alma sonrası işlem otomatik eklenmeli, toast gösterilmelidir.
- **FR-05.7** Favori (heart) butonu istek listesine ekleyebilmelidir.

### FR-06 Kişisel Öneriler (Recommendations)
- **FR-06.1** 4 yapılandırılmış kart gösterilmelidir: Tasarruf, Bütçe, Yatırım, Alışveriş.
- **FR-06.2** Her kart icon, başlık, kısa metin içermelidir.
- **FR-06.3** "Daha fazla" butonu Gemini'den ek öneri istemelidir.
- **FR-06.4** Yenile butonu yeni öneri seti getirmelidir.
- **FR-06.5** Detaylı analiz Markdown render edilmelidir.

### FR-07 Abonelik Takibi
- **FR-07.1** Abonelikler isim, tutar, dönem, başlangıç tarihi ile listelenmelidir.
- **FR-07.2** Yıllık toplam ve aylık ortalama gösterilmelidir.
- **FR-07.3** AI ile "iptal edilebilir" önerisi sunulmalıdır.
- **FR-07.4** Abonelik ekleme/silme/düzenleme desteklenmelidir.
- **FR-07.5** Yenileme tarihi yaklaşan abonelik için bildirim gösterilmelidir.

### FR-08 Finansal Okuryazarlık
- **FR-08.1** Modüller listelenmelidir (Bütçe 101, Yatırım 101, Borç Yönetimi vb.)
- **FR-08.2** Quiz desteği olmalıdır.
- **FR-08.3** İlerleme yüzdesi takip edilmelidir.
- **FR-08.4** AI ile kişiselleştirilmiş içerik üretilmelidir.

### FR-09 Anomali Tespiti
- **FR-09.1** Z-score tabanlı algoritma çalıştırılmalıdır.
- **FR-09.2** Şüpheli işlem dashboard'da uyarı olarak gösterilmelidir.
- **FR-09.3** Kullanıcı işlemi "doğrula" veya "yok say" olarak işaretleyebilmelidir.

### FR-10 Demo Sıfırlama
- **FR-10.1** Tek tıkla tüm kullanıcı verisi sıfırlanabilmelidir.
- **FR-10.2** İşlem geri alınamaz; çift onay gerekir.
- **FR-10.3** Sıfırlama sonrası seed verisi yüklenmelidir.

### FR-11 Fiş OCR (Vision)
- **FR-11.1** Kullanıcı fiş fotoğrafı yükleyebilmelidir.
- **FR-11.2** Gemini Vision ile tutar/kategori çıkarılmalıdır.
- **FR-11.3** Sonuç onaya sunulmalı, kullanıcı düzenleyebilmelidir.

### FR-12 İstek Listesi
- **FR-12.1** Ürün ekleme/silme.
- **FR-12.2** AI ile "şu an alınmalı mı?" analizi.
- **FR-12.3** Hedefe ne kadar kaldığı (tasarruf takvimi).

---

## 5. Fonksiyonel Olmayan Gereksinimler

### NFR-01 Performans
- İlk anlamlı boyama (LCP) ≤ **2.5 sn** (3G).
- API yanıtı (DB hit) ≤ **300 ms** p95.
- LLM yanıtı ≤ **6 sn** p95 (stream başlangıcı ≤ 1.5 sn).
- Bundle size ≤ **250 KB** (gzip, ilk yük).

### NFR-02 Erişilebilirlik (a11y)
- WCAG 2.1 AA uyumu.
- Tüm interaktif öğeler keyboard erişilebilir.
- ARIA etiketleri zorunlu (modal, toast, form alanları).
- Renk kontrastı ≥ 4.5:1.

### NFR-03 Güvenlik
- API anahtarları sadece sunucu tarafında.
- Cookie `httpOnly`, `secure`, `sameSite=lax`.
- DB sorguları parametrize.
- LLM girdileri 4000 token ile sınırlı (prompt injection koruması).
- Rate limit: 30 req/dk per IP.

### NFR-04 Sürdürülebilirlik
- Test kapsamı ≥ %70.
- Lint/Format CI'da zorunlu.
- Tüm public API'lar JSDoc ile belgelenmiş.

### NFR-05 Tarayıcı Uyumluluğu
- Chrome 110+, Safari 16+, Firefox 110+, Edge 110+.
- IE / eski sürüm desteklenmez.

### NFR-06 İ18n
- Şu an: tr-TR.
- Hedef: en-US (Faz 3).
- `next-intl` veya `react-i18next` planlanmıştır.

### NFR-07 Gözlemlenebilirlik
- Sentry / equivalent error tracking.
- Vercel Analytics (Web Vitals).
- Log seviyesi: prod=warn, dev=debug.

---

## 6. Veri Modeli

### 6.1 UserProfile

```ts
interface UserProfile {
  userId: string;
  name: string;
  monthlyIncome: number;
  monthlyBudget: number;
  savingsGoal: number;
  riskTolerance: "düşük" | "orta" | "yüksek";
  goals: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 6.2 Transaction

```ts
interface Transaction {
  _id?: string;
  userId: string;
  type: "gelir" | "gider";
  category: Category;
  amount: number;
  note?: string;
  date: string; // ISO
}
```

### 6.3 Category (Enum)
`Gıda | Ulaşım | Kira/Fatura | Eğlence | Alışveriş | Sağlık | Eğitim | Yatırım | Diğer`

### 6.4 ChatMessage

```ts
interface ChatMessage {
  _id?: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
```

### 6.5 Product / EnrichedProduct
Bkz. `src/lib/types.ts`. Eklenenler: `affordableNow`, `recommendedInstallment`, `monthly`, `advice`, `riskLevel`, `budgetImpactPct`.

### 6.6 Subscription (Yeni)

```ts
interface Subscription {
  _id?: string;
  userId: string;
  name: string;
  amount: number;
  cycle: "monthly" | "yearly";
  startDate: string;
  category: Category;
  active: boolean;
  cancelRecommended?: boolean;
}
```

### 6.7 WishlistItem (Yeni)

```ts
interface WishlistItem {
  _id?: string;
  userId: string;
  productName: string;
  targetPrice: number;
  currentPrice?: number;
  priorityScore: number; // 0-100
  aiAnalysis?: string;
  createdAt: string;
}
```

---

## 7. API Spesifikasyonu

| Endpoint | Method | Açıklama | Auth |
|---|---|---|---|
| `/api/user` | GET, PUT | Profil oku/güncelle | Cookie |
| `/api/transactions` | GET, POST | İşlem listele/ekle | Cookie |
| `/api/transactions/[id]` | PUT, DELETE | İşlem güncelle/sil | Cookie |
| `/api/chat` | GET, POST, DELETE | Mesaj listele/gönder/temizle | Cookie |
| `/api/recommendations` | GET | AI önerileri | Cookie |
| `/api/products` | GET | Ürün listesi (zenginleştirilmiş) | Cookie |
| `/api/products/buy` | POST | Satın alma → işlem ekle | Cookie |
| `/api/subscriptions` | GET, POST | Abonelik CRUD | Cookie |
| `/api/subscriptions/[id]` | PUT, DELETE | Abonelik update/sil | Cookie |
| `/api/wishlist` | GET, POST | İstek listesi | Cookie |
| `/api/wishlist/analyze` | POST | AI satın alma analizi | Cookie |
| `/api/literacy` | GET, POST | Modül listesi/ilerleme | Cookie |
| `/api/vision/receipt` | POST | Fiş OCR | Cookie |
| `/api/import` | POST | CSV içe aktarma | Cookie |
| `/api/admin/reset` | POST | Demo sıfırlama | Cookie |

### 7.1 Hata Kodları
- `400` Geçersiz girdi
- `401` Kimlik doğrulanmamış
- `404` Kaynak bulunamadı
- `429` Rate limit aşıldı
- `500` Sunucu hatası
- `503` LLM servisi çevrim dışı

### 7.2 Standart Yanıt Şeması

```ts
interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}
```

---

## 8. Kullanıcı Arayüzü Gereksinimleri

### 8.1 Genel Tasarım Prensipleri
- **Ana Renk**: Brand-600 (#5b6cff)
- **Arkaplan**: Slate-50
- **Köşe Yarıçapı**: 12-24px
- **Tipografi**: Inter, sistem fontu fallback
- **Animasyon**: 150-300ms cubic-bezier

### 8.2 Sayfa Listesi
1. **/** Dashboard
2. **/profile** Profil
3. **/chat** Sohbet
4. **/products** Ürünler
5. **/recommendations** Öneriler
6. **/subscriptions** Abonelikler
7. **/literacy** Okuryazarlık
8. **/wishlist** İstek Listesi (planlı)

### 8.3 Bileşen Kütüphanesi
- `Modal`, `Badge`, `Skeleton`, `EmptyState`, `ProgressBar`, `Avatar`
- `Toast` provider + `useToast` hook
- `StatCard`, `InsightsRow`, `BudgetAlert`
- `SpendingPie`, `IncomeExpenseLine`
- `Markdown` renderer

### 8.4 Responsive Breakpoint'ler
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- Mobil (<768px): Bottom navigation

---

## 9. Güvenlik ve Gizlilik

- **PII**: Sadece isim ve finansal veri saklanır; e-posta opsiyonel.
- **Şifreleme**: DB at-rest (Atlas default), TLS in-transit.
- **GDPR/KVKK**: Veri silme endpoint'i (`/api/admin/reset`).
- **LLM Veri Politikası**: Gemini'ye gönderilen veri özetlenmiş ve anonimleştirilmiş olmalı; isim/IBAN gönderilmez.
- **Audit Log**: Faz 3'te eklenecek.

---

## 10. Mevcut Durum Analizi (Gap Analysis)

### 10.1 Tamamlanan Özellikler ✅
- [x] Layout + ToastProvider
- [x] Dashboard temel kartları (StatCard, InsightsRow, BudgetAlert)
- [x] Profil CRUD + filtreleme + demo sıfırla
- [x] Ürünler arama + satın al modalı + badge
- [x] Chat: Markdown render, geçmiş temizleme, hızlı aksiyonlar
- [x] Recommendations: 4 yapılandırılmış kart
- [x] Skeleton loaders + EmptyState
- [x] Temel TypeScript tipleri (`src/lib/types.ts`)

### 10.2 Eksik / Hatalı Çalışan Özellikler ❌

#### Yüksek Öncelik (P0)
| # | Konu | Mevcut Durum | Hedef |
|---|---|---|---|
| 1 | `tsconfig.json` path alias | `@/lib/api` lint hatası veriyor | `paths: { "@/*": ["./src/*"] }` doğrula |
| 2 | API response tipleri | Çoğu yerde `any` | `ApiResponse<T>` jenerik tipi |
| 3 | Form validasyonu | Yok | Zod / RHF entegrasyonu |
| 4 | Chat hata toast'ı | Sadece mesaj olarak | `toast.error` ile gösterim |
| 5 | Rate limit | Yok | `/api/chat` ve `/api/recommendations` |
| 6 | Demo sıfırlama çift onay | Tek `confirm()` | Modal + yazılı onay |

#### Orta Öncelik (P1)
| # | Konu | Açıklama |
|---|---|---|
| 7 | Subscriptions sayfası | UI mevcut ancak AI iptal önerisi entegre değil |
| 8 | Literacy sayfası | İçerik statik, quiz yok |
| 9 | Wishlist | API var, UI yok |
| 10 | Vision/Receipt | API var, UI ekleme akışı yok |
| 11 | CSV import | Endpoint var, dosya yükleme arayüzü yok |
| 12 | Anomali kartı | Dashboard'da gösterilmiyor |
| 13 | Recommendations "Daha fazla" | Buton yok |
| 14 | Streaming chat | Tek seferlik response |

#### Düşük Öncelik (P2)
| # | Konu | Açıklama |
|---|---|---|
| 15 | Dark mode | Tema değiştirici yok |
| 16 | i18n | Sabit Türkçe |
| 17 | PWA | Manifest yok |
| 18 | Error boundary | Yok |
| 19 | Web Vitals | Telemetri yok |
| 20 | Test kapsamı | Hiç test yok |
| 21 | Storybook | Yok |
| 22 | Accessibility audit | Yapılmadı |

### 10.3 Bilinen Buglar
- **B-001**: Profile sayfasında uzun kategori listesi mobilde taşıyor.
- **B-002**: Chat sayfasında uzun yanıtta scroll otomatik en alta inmiyor (bazen).
- **B-003**: Products sayfasında image lazy-loading yok; ilk yük yavaş.
- **B-004**: Modal açıkken body scroll devam ediyor.
- **B-005**: `useToast` provider olmadan çağrıldığında runtime hatası verebilir.
- **B-006**: Demo sıfırlama sonrası bazı state'ler stale kalıyor (full refresh gerekiyor).

---

## 11. Geliştirme Yol Haritası (Roadmap)

### 🟢 Faz 1 — Stabilizasyon (Hafta 1-2)
**Hedef**: Hackathon kodunu üretim kalitesine yaklaştır.
- TypeScript path alias ve lint hatalarını çöz
- `ApiResponse<T>` tipini her endpoint'e uygula
- Form validasyonu (Zod)
- Error boundary + global hata sayfası
- Tüm bilinen bug'ları (B-001..B-006) çöz
- Skeleton & empty state'leri tüm sayfalara genişlet
- Rate limit middleware

### 🟡 Faz 2 — Özellik Tamamlama (Hafta 3-5)
**Hedef**: SRS'teki tüm fonksiyonel gereksinimleri kapat.
- Subscriptions: AI iptal önerisi UI'ı
- Wishlist: Tam UI + AI analiz akışı
- Literacy: Quiz motoru + ilerleme
- Vision/Receipt: Yükleme akışı
- CSV import: Drag-drop UI
- Anomali kartı dashboard entegrasyonu
- Streaming chat (SSE)
- Recommendations "Daha fazla" + paylaşım
- Bottom navigation iyileştirmesi (mobil)

### 🟠 Faz 3 — Kalite ve Ölçeklenme (Hafta 6-8)
**Hedef**: Üretim ortamına dağıtılabilir kıvama getir.
- Test altyapısı: Vitest + Playwright
- Test kapsamı %70+
- Sentry entegrasyonu
- Vercel Analytics + custom event'ler
- Performance bütçesi (Lighthouse CI)
- Storybook + bileşen dokümantasyonu
- Accessibility audit + düzeltmeler
- Dark mode
- i18n (en-US ekle)

### 🔵 Faz 4 — Büyüme (Hafta 9-12)
**Hedef**: Kullanıcı tabanı için hazırla.
- Auth (NextAuth / Clerk)
- Multi-user gerçek hesaplar
- Email bildirimleri (Resend)
- Mobil PWA + push notification
- Banka API entegrasyonu (Open Banking)
- Yatırım modülü (gerçek piyasa verisi)
- Premium özellikler + ödeme (Stripe/iyzico)

---

## 12. Sprint Planı

### Sprint 1 (1 hafta) — "Stabilization Sprint"
**Story Points**: ~34

| ID | Görev | SP | Sahip |
|---|---|---|---|
| S1-01 | tsconfig path düzelt | 1 | FE |
| S1-02 | `ApiResponse<T>` tipini tanımla | 2 | FE |
| S1-03 | API endpoint'lerini tipe uyumla | 5 | BE |
| S1-04 | Zod ile profil/işlem formu validasyonu | 5 | FE |
| S1-05 | Error boundary | 2 | FE |
| S1-06 | Modal scroll lock fix (B-004) | 1 | FE |
| S1-07 | Toast provider runtime guard (B-005) | 1 | FE |
| S1-08 | Demo sıfırlama state refresh (B-006) | 2 | FE |
| S1-09 | Image lazy-loading (B-003) | 1 | FE |
| S1-10 | Chat scroll fix (B-002) | 1 | FE |
| S1-11 | Mobil kategori taşma (B-001) | 1 | FE |
| S1-12 | Rate limit middleware | 3 | BE |
| S1-13 | Loglama standartı (`pino`) | 2 | BE |
| S1-14 | README ve geliştirici onboarding | 2 | TL |
| S1-15 | CI: lint + tsc + build | 3 | DevOps |
| S1-16 | Skeleton'lar tüm sayfalarda | 2 | FE |

### Sprint 2 (1 hafta) — "Feature Completion I"
| ID | Görev | SP |
|---|---|---|
| S2-01 | Subscriptions AI iptal önerisi UI | 5 |
| S2-02 | Subscriptions yenileme bildirimi | 3 |
| S2-03 | Wishlist UI tam akış | 8 |
| S2-04 | Wishlist AI analizi entegrasyonu | 3 |
| S2-05 | Anomali kartı dashboard'da | 3 |
| S2-06 | CSV import drag-drop UI | 5 |

### Sprint 3 (1 hafta) — "Feature Completion II"
| ID | Görev | SP |
|---|---|---|
| S3-01 | Literacy quiz motoru | 8 |
| S3-02 | Literacy ilerleme tracking | 3 |
| S3-03 | Vision/Receipt yükleme akışı | 5 |
| S3-04 | Streaming chat (SSE) | 8 |
| S3-05 | Recommendations "Daha fazla" | 3 |
| S3-06 | Bottom nav mobil iyileştirme | 2 |

### Sprint 4-5 — "Quality Sprint"
- Test altyapısı, %70 kapsam
- Sentry, analytics
- Storybook
- a11y audit
- Lighthouse CI

### Sprint 6+ — "Growth"
- Auth, banking API, payments

---

## 13. Teknik Borç (Technical Debt)

| ID | Borç | Etki | Çözüm |
|---|---|---|---|
| TD-01 | `any` kullanımı (≥30 yer) | Tip güvenliği zayıf | Jenerik tipler + `unknown` |
| TD-02 | API client tek dosyada | Sürdürülebilirlik | Endpoint başına modülasyon |
| TD-03 | Inline LLM prompt'ları | Test edilemez | `src/lib/prompts/` altına çıkar |
| TD-04 | Memory store + DB ikilemi | State sync sorunu | Repository pattern |
| TD-05 | `console.log` debug | Üretimde gürültü | `pino` logger |
| TD-06 | CSS class duplikasyonu | Bakım zor | `@apply` ile ortak class |
| TD-07 | Magic number'lar (limit=20 vb.) | Okunabilirlik | `src/lib/constants.ts` |
| TD-08 | Test yok | Regresyon riski | Vitest + Playwright |

---

## 14. Test Stratejisi

### 14.1 Test Piramidi
- **Unit (60%)**: `src/lib/finance.ts`, `anomaly.ts`, util'ler.
- **Integration (30%)**: API route handler'lar (Mongo memory server).
- **E2E (10%)**: Playwright ile temel akışlar (profil, işlem, chat).

### 14.2 Araçlar
- **Vitest** (unit/integration)
- **Playwright** (E2E)
- **MSW** (mock API)
- **mongodb-memory-server** (DB mocking)

### 14.3 Kritik Test Senaryoları
1. Yeni kullanıcı → demo seed → dashboard yükleniyor.
2. İşlem ekle → dashboard güncelleniyor.
3. Bütçe aşımı → BudgetAlert görünüyor.
4. Chat soru → AI yanıt → markdown render.
5. Demo sıfırla → tüm veriler default'a dönüyor.
6. Anomali tespiti → kart görünüyor.

### 14.4 Test Verisi
- `src/lib/__fixtures__/` altında deterministik seed.
- Snapshot test'ler kritik bileşenler için.

---

## 15. Dağıtım (Deployment) Stratejisi

### 15.1 Ortamlar
- **dev** → localhost:3000
- **staging** → finans-asistani-staging.vercel.app
- **prod** → app.akillifinans.tr (planlı)

### 15.2 CI/CD (GitHub Actions)
1. PR açıldı → lint, tsc, test, build
2. main'e merge → staging'e deploy
3. Manuel onay → prod'a deploy

### 15.3 Environment Variables

| Değişken | Açıklama | Zorunlu |
|---|---|---|
| `MONGODB_URI` | Atlas connection string | Hayır (memory fallback) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini key | Hayır (demo cevap) |
| `RATE_LIMIT_REDIS_URL` | Upstash Redis | Hayır |
| `SENTRY_DSN` | Hata izleme | Hayır |
| `NEXT_PUBLIC_APP_URL` | Public URL | Evet |

---

## 16. İzleme ve Gözlemlenebilirlik

- **Hata İzleme**: Sentry (frontend + backend)
- **Performans**: Vercel Analytics + Web Vitals
- **Loglama**: pino → Logtail / Datadog
- **Uyarı**: P95 > 2sn → Slack
- **KPI Dashboard**: Aylık aktif kullanıcı, AI mesaj sayısı, churn

---

## 17. Risk Yönetimi

| Risk | Olasılık | Etki | Azaltma |
|---|---|---|---|
| Gemini API kotası dolar | Orta | Yüksek | Cache + rate limit + memory fallback |
| MongoDB bağlantısı kopar | Düşük | Yüksek | Memory store fallback |
| Prompt injection saldırısı | Orta | Yüksek | Input sanitization + system prompt katmanı |
| KVKK denetimi | Düşük | Yüksek | Veri silme + log + anonimleştirme |
| Çekirdek geliştirici yokluğu | Orta | Orta | Pair programming + dokümantasyon |
| Hackathon sonrası ivme kaybı | Yüksek | Orta | Yol haritası + topluluk |

---

## 18. Kabul Kriterleri

Bir özellik **DONE** sayılması için:
- [ ] Kod review (≥1 onay)
- [ ] Lint + tsc başarılı
- [ ] Birim test eklendi (varsa hesaplama)
- [ ] Manuel QA checklist tamamlandı
- [ ] a11y kontrolü (Tab, ARIA)
- [ ] Mobil + masaüstü test edildi
- [ ] Toast / hata yönetimi var
- [ ] Loading & empty state'ler tanımlı
- [ ] Dokümantasyon güncel (README / SRS)

---

## 19. Sözlük (Glossary)

- **App Router**: Next.js 13+ dosya tabanlı routing.
- **LLM**: Büyük dil modeli (Gemini gibi).
- **Memory Store**: DB olmadığında in-memory veri saklama.
- **Seed**: Demo başlangıç verisi.
- **Story Point (SP)**: Görev karmaşıklık ölçüsü (Fibonacci: 1,2,3,5,8,13).
- **Toast**: Kısa süreli bildirim balonu.

---

## Ek A — Açık Sorular
1. Auth sağlayıcı: NextAuth mı Clerk mı?
2. Üretim DB: MongoDB Atlas free tier yeterli mi?
3. LLM maliyet bütçesi aylık?
4. Banka API entegrasyonu için iş ortağı (e.g. Param)?
5. iOS/Android native uygulama gerekli mi yoksa PWA yeterli mi?

## Ek B — Referanslar
- Next.js 14 App Router Docs
- Google Generative AI SDK Docs
- WCAG 2.1 Guidelines
- KVKK Madde 7 (Silme Hakkı)
- TS Best Practices — Anders Hejlsberg

---

> **Not:** Bu doküman canlıdır. Her sprint sonunda gözden geçirilir; değişiklikler `## Sürüm Geçmişi` altında loglanır.

## Sürüm Geçmişi
| Sürüm | Tarih | Değişiklik | Yazar |
|---|---|---|---|
| 1.0 | 2026-05-12 | İlk yayın | Cascade |
