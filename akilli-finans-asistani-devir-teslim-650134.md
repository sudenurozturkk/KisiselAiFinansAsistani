# Akıllı Finans Asistanı - Devir-Teslim Dokümanı

Bu doküman, projenin yeni bir geliştirici tarafından devam ettirilebilmesi için tüm gerekli bilgileri içerir.

## Proje Özeti

**Amaç**: Kişisel finans yönetimi ve e-ticaret alışverişini birleştiren, Google Gemini AI destekli bir asistan platformu. Kullanıcıların bütçelerini takip etmeleri, harcamalarını analiz etmeleri ve alışveriş kararlarını bütçelerine göre vermeleri için kişiselleştirilmiş tavsiyeler sunar.

**Hedef Kullanıcı**: Bütçe yönetimi yapmak isteyen, alışveriş yaparken finansal durumunu göz önünde bulunduran, yapay zeka destekli tavsiyelerden yararlanmak isteyen bireysel kullanıcılar.

**Ana Özellikler**:
- Dashboard: Aylık gelir/gider, net, bütçe kullanımı; pasta, çizgi ve bar grafikleri
- Ürünler: 20+ ürün, bütçeye göre uygunluk, taksit önerisi, AI tabanlı satın alma tavsiyesi
- AI Sohbet: Kullanıcının profili ve harcamalarını system prompt'a enjekte ederek kişiselleştirilmiş yanıtlar
- Öneriler: Tek tıkla bütçe analizi, tasarruf ve yatırım fikirleri
- Profil: Bütçe, gelir, tasarruf hedefi, risk toleransı ayarları + manuel işlem girişi
- İşlem Yönetimi: İşlem ekleme, düzenleme, silme

## Teknik Mimari

### Teknoloji Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, React 18
- **Styling**: TailwindCSS
- **Veri Görselleştirme**: Recharts
- **Backend**: Next.js API Routes
- **Veritabanı**: MongoDB (Mongoose) + In-Memory Fallback
- **AI**: Google Gemini API (`@google/generative-ai`)
- **İkonlar**: Lucide React
- **Demo Auth**: LocalStorage tabanlı kullanıcı ID yönetimi

### Dosya Yapısı
```
src/
├── app/
│   ├── layout.tsx              # Root layout (ToastProvider ekleme bekliyor)
│   ├── page.tsx                # Dashboard (insights, budget alert ekleme bekliyor)
│   ├── products/
│   │   └── page.tsx            # Ürünler (satın al butonu, arama ekleme bekliyor)
│   ├── profile/
│   │   └── page.tsx            # Profil (edit/delete, filtreler, sıfırla butonu bekliyor)
│   ├── chat/
│   │   └── page.tsx            # Sohbet (markdown, geçmişi temizle ekleme bekliyor)
│   ├── recommendations/
│   │   └── page.tsx            # Öneriler (yapılandırılmış kartlar bekliyor)
│   ├── api/
│   │   ├── user/route.ts       # Kullanıcı profili GET/PUT
│   │   ├── transactions/
│   │   │   ├── route.ts       # İşlemler GET/POST
│   │   │   └── [id]/route.ts  # İşlem PUT/DELETE ✅
│   │   ├── products/
│   │   │   ├── route.ts       # Ürünler GET
│   │   │   └── buy/route.ts   # Ürün satın alma POST ✅
│   │   ├── chat/route.ts      # Sohbet GET/POST/DELETE ✅
│   │   ├── recommendations/
│   │   │   └── route.ts       # Öneriler GET
│   │   └── admin/
│   │       └── reset/route.ts # Demo sıfırlama POST ✅
│   └── globals.css            # TailwindCSS + özel sınıflar
├── components/
│   ├── Sidebar.tsx            # Navigasyon + avatar + mobile nav ✅
│   ├── StatCard.tsx           # İstatistik kartı
│   ├── Charts.tsx             # Recharts grafik bileşenleri
│   ├── Toast.tsx             # Bildirim sistemi ✅
│   ├── ui.tsx                 # ProgressBar, Avatar, Skeleton, Badge, Modal, EmptyState ✅
│   ├── Markdown.tsx           # Hafif markdown render ✅
│   ├── Insights.tsx           # Finansal içgörüler ✅
│   └── BudgetAlert.tsx        # Bütçe uyarısı ✅
└── lib/
    ├── types.ts               # TypeScript tipleri (genişletildi ✅)
    ├── store.ts               # In-memory fallback
    ├── db.ts                  # MongoDB bağlantı
    ├── models.ts              # Mongoose şemaları
    ├── repo.ts                # Veri katmanı (update/delete/reset eklendi ✅)
    ├── gemini.ts              # Gemini AI entegrasyonu
    ├── finance.ts             # Finansal hesaplamalar (insights eklendi ✅)
    ├── products.ts            # Ürün seed verisi (20+ ürün ✅)
    ├── userId.ts              # LocalStorage userId
    ├── auth.ts                # Header'dan userId çıkarma
    └── api.ts                 # Client API helper (yeni endpoint'ler eklendi ✅)
```

## Tamamlanan Özellikler

### Backend (API Routes)
- ✅ Kullanıcı profili GET/PUT (`/api/user`)
- ✅ İşlemler GET/POST (`/api/transactions`)
- ✅ İşlem güncelleme/silme (`/api/transactions/[id]`)
- ✅ Ürünler GET (`/api/products`)
- ✅ Ürün satın alma (`/api/products/buy`)
- ✅ Sohbet GET/POST/DELETE (`/api/chat`)
- ✅ Öneriler GET (`/api/recommendations`)
- ✅ Demo sıfırlama (`/api/admin/reset`)

### Veri Katmanı
- ✅ MongoDB + In-Memory fallback
- ✅ 6 aylık zengin işlem seed verisi (değişken kalemler)
- ✅ 20+ ürün seed verisi (brand, badge, tag)
- ✅ İşlem update/delete/reset metodları
- ✅ Finansal özet: tasarruf oranı, günlük ortalama, tahmini ay sonu, bütçe kullanımı
- ✅ Insights: tasarruf oranı, günlük ortalama, geçen aya göre değişim, en yüksek kategori, hedef ilerleme
- ✅ Bütçe alarmı seviyeleri (ok/warn/danger)

### UI Component'leri
- ✅ Toast bildirim sistemi (context-based)
- ✅ Avatar (isimden renkli avatar)
- ✅ ProgressBar (tone: brand/good/warn/bad)
- ✅ Skeleton (loading state)
- ✅ Badge (tone-based)
- ✅ EmptyState
- ✅ Modal
- ✅ Markdown renderer (chat için)
- ✅ InsightsRow (finansal içgörüler)
- ✅ BudgetAlert (bütçe uyarısı)
- ✅ Sidebar (avatar, mobil bottom nav)

### Client API Helper
- ✅ `getUser`, `updateUser`
- ✅ `getTransactions`, `addTransaction`, `updateTransaction`, `deleteTransaction`
- ✅ `getProducts`, `buyProduct`
- ✅ `getMessages`, `sendMessage`, `clearMessages`
- ✅ `getRecommendations`
- ✅ `resetDemo`

## Eksik Olanlar

### 1. Layout Güncellemeleri
- ❌ `layout.tsx`'e `ToastProvider` ekle
- ❌ Mobil bottom nav için `main`'e `pb-16 md:pb-0` padding ekle
- ❌ Header bar ekle (mobilde menü butonu, masaüstünde kullanıcı avatar + logout)

### 2. Dashboard (`src/app/page.tsx`)
- ❌ `InsightsRow` component'ini ekle (API'den gelen `insights` verisini kullan)
- ❌ `BudgetAlert` component'ini ekle (`summary.thisMonth`, `user.monthlyBudget` kullan)
- ❌ `StatCard`'ları insights ile güncelle
- ❌ Tasarruf hedefi ilerleme çubuğu ekle

### 3. Products (`src/app/products/page.tsx`)
- ❌ Arama input'u ekle (isim/brand/kategori)
- ❌ "Satın Al" butonu ekle (taksit seçimi + `api.buyProduct` çağrısı)
- ❌ Badge gösterimi (yeni/fırsat/popüler/eko/sınırlı)
- ❌ Favori butonu (localStorage ile)
- ❌ Kategori filtreleri
- ❌ Fiyat sıralama

### 4. Profile (`src/app/profile/page.tsx`)
- ❌ İşlem listesinde edit/delete butonları ekle
- ❌ İşlem düzenleme modal'ı
- ❌ İşlem filtreleri (kategori, tür, tarih aralığı)
- ❌ "Demo Sıfırla" butonu (`api.resetDemo` çağrısı)
- ❌ Toast feedback ekle (kayıt başarılı/başarısız)

### 5. Chat (`src/app/chat/page.tsx`)
- ❌ `Markdown` component'ini assistant mesajlarında kullan
- ❌ "Geçmişi Temizle" butonu (`api.clearMessages` çağrısı)
- ❌ Hızlı aksiyon butonları (örn: "Bütçemi analiz et", "Tasarruf önerileri")
- ❌ Mesaj gönderirken loading state göster
- ❌ Hata durumunda toast göster

### 6. Recommendations (`src/app/recommendations/page.tsx`)
- ❌ Yapılandırılmış kartlar:
  - Tasarruf önerileri
  - Bütçe ayarlamaları
  - Yatırım fikirleri
  - Alışveriş tavsiyeleri
- ❌ Her karte için icon + tone
- ❌ "Daha fazla" butonu (Gemini'den ek öneri getir)

### 7. Tip Güvenliği
- ❌ `any` kullanımlarını azalt
- ❌ Ortak interface'leri çıkar (örn. `ApiResponse<T>`)
- ❌ API response tiplerini tanımla
- ❌ Component prop tiplerini sıkılaştır

### 8. UX İyileştirmeleri
- ❌ Loading skeleton'lar ekle (sayfa yüklenirken)
- ❌ Empty state'ler ekle (veri yoksa)
- ❌ Error boundary ekle
- ❌ Form validasyonları
- ❌ Accessibility (ARIA labels, keyboard nav)

### 9. Diğer
- ❌ Dark mode desteği (opsiyonel)
- ❌ PWA manifest (opsiyonel)
- ❌ Testler (opsiyonel)

## API Endpoint'leri

### Kullanıcı
- `GET /api/user` - Kullanıcı profili
- `PUT /api/user` - Profil güncelleme

### İşlemler
- `GET /api/transactions` - İşlem listesi + özet + insights
- `POST /api/transactions` - Yeni işlem ekleme
- `PUT /api/transactions/[id]` - İşlem güncelleme
- `DELETE /api/transactions/[id]` - İşlem silme

### Ürünler
- `GET /api/products` - Ürün listesi + bütçe bağlamı
- `POST /api/products/buy` - Ürün satın alma (gider oluşturma)

### Sohbet
- `GET /api/chat` - Mesaj geçmişi
- `POST /api/chat` - Mesaj gönderme
- `DELETE /api/chat` - Geçmişi temizleme

### Öneriler
- `GET /api/recommendations` - AI önerileri + özet + insights

### Yönetim
- `POST /api/admin/reset` - Demo verilerini sıfırlama

## Ortam Değişkenleri

`.env.local` dosyasında tanımlanmalı:
```
MONGODB_URI=mongodb+srv://...
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-1.5-flash
```

**Not**: Değişkenler boş bırakılırsa:
- MongoDB yoksa in-memory store kullanılır
- Gemini API key yoksa mock yanıtlar üretilir

## Kurulum ve Çalıştırma

```bash
# Bağımlılıkları yükle
npm install

# Ortam değişkenlerini ayarla
cp .env.example .env.local
# .env.local dosyasını düzenle

# Geliştirme sunucusunu başlat
npm run dev
```

Tarayıcıdan `http://localhost:3000` adresine eriş.

## Devam Etme Talimatları

### Öncelik Sırası (Yüksek Etki)
1. **Layout Güncellemeleri**: ToastProvider ekle, mobil nav padding ayarla
2. **Dashboard**: InsightsRow ve BudgetAlert ekle
3. **Products**: Satın al butonu + arama
4. **Profile**: İşlem edit/delete + sıfırla butonu
5. **Chat**: Markdown + geçmişi temizle
6. **Recommendations**: Yapılandırılmış kartlar

### Kod Standartları
- TypeScript kullan, `any` mümkün olduğunca azalt
- Component'leri küçük ve odaklı tut
- API çağrılarında hata yönetimi ve toast feedback
- Responsive tasarım (mobil öncelikli)
- Clean code prensipleri (SOLID, DRY)

### Test Etme
- Her sayfa için manuel test:
  - Dashboard: insights görünüyor mu? bütçe alarmı çalışıyor mu?
  - Products: satın al butonu işlem oluşturuyor mu?
  - Profile: edit/delete çalışıyor mu? sıfırlama çalışıyor mu?
  - Chat: markdown render doğru mu? geçmiş temizleniyor mu?
  - Recommendations: kartlar yapılandırılmış mı?

## Bilinen Sorunlar

1. **Lint Uyarıları**: Bazı dosyalarda `any` kullanımı var, tip güvenliği artırılacak
2. **Layout**: ToastProvider entegre edilmedi
3. **Mobil**: Bottom nav için padding eksik
4. **Sayfalar**: Yeni component'ler entegre edilmedi

## İletişim

Bu proje Next.js 14 App Router, TypeScript, TailwindCSS, MongoDB, ve Google Gemini AI kullanılarak geliştirilmiştir. Herhangi bir soru için proje başlangıç dokümanlarına bakabilirsiniz.
