/**
 * TwelveData Market Veri Servisi
 *
 * Gerçek zamanlı piyasa verileri: altın, döviz, hisse, kripto.
 * 5 dakikalık in-memory cache ile rate-limit koruması.
 *
 * Ücretsiz plan: 800 istek/gün, 8 istek/dakika.
 */

/* ─── Konfigürasyon ────────────────────────────────────────── */

const TWELVEDATA_BASE = "https://api.twelvedata.com";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 dakika

function getApiKey(): string {
  return process.env.TWELVEDATA_API_KEY || "";
}

/* ─── Türkiye Borsa Sembol Haritası ────────────────────────── */

/** Türkçe isim / kısaltma → TwelveData sembolü */
export const SYMBOL_MAP: Record<string, { symbol: string; exchange: string; name: string }> = {
  // Hisse senetleri (BIST)
  "THYAO": { symbol: "THYAO", exchange: "BIST", name: "Türk Hava Yolları" },
  "THY":   { symbol: "THYAO", exchange: "BIST", name: "Türk Hava Yolları" },
  "GARAN": { symbol: "GARAN", exchange: "BIST", name: "Garanti BBVA" },
  "GARANTI": { symbol: "GARAN", exchange: "BIST", name: "Garanti BBVA" },
  "AKBNK": { symbol: "AKBNK", exchange: "BIST", name: "Akbank" },
  "AKBANK": { symbol: "AKBNK", exchange: "BIST", name: "Akbank" },
  "ISCTR": { symbol: "ISCTR", exchange: "BIST", name: "İş Bankası C" },
  "ISBANK": { symbol: "ISCTR", exchange: "BIST", name: "İş Bankası C" },
  "İŞ BANKASI": { symbol: "ISCTR", exchange: "BIST", name: "İş Bankası C" },
  "SISE":  { symbol: "SISE",  exchange: "BIST", name: "Şişecam" },
  "TUPRS": { symbol: "TUPRS", exchange: "BIST", name: "Tüpraş" },
  "SAHOL": { symbol: "SAHOL", exchange: "BIST", name: "Sabancı Holding" },
  "KCHOL": { symbol: "KCHOL", exchange: "BIST", name: "Koç Holding" },
  "EREGL": { symbol: "EREGL", exchange: "BIST", name: "Erdemir" },
  "ASELS": { symbol: "ASELS", exchange: "BIST", name: "Aselsan" },
  "ASELSAN": { symbol: "ASELS", exchange: "BIST", name: "Aselsan" },
  "BIMAS": { symbol: "BIMAS", exchange: "BIST", name: "BİM Mağazaları" },
  "BIM":   { symbol: "BIMAS", exchange: "BIST", name: "BİM Mağazaları" },
  "PGSUS": { symbol: "PGSUS", exchange: "BIST", name: "Pegasus Havayolları" },
  "PEGASUS": { symbol: "PGSUS", exchange: "BIST", name: "Pegasus Havayolları" },
  "SASA":  { symbol: "SASA",  exchange: "BIST", name: "SASA Polyester" },
  "TAVHL": { symbol: "TAVHL", exchange: "BIST", name: "TAV Havalimanları" },
  "TOASO": { symbol: "TOASO", exchange: "BIST", name: "Tofaş Oto" },
  "TCELL": { symbol: "TCELL", exchange: "BIST", name: "Turkcell" },
  "TURKCELL": { symbol: "TCELL", exchange: "BIST", name: "Turkcell" },
  "VESTL": { symbol: "VESTL", exchange: "BIST", name: "Vestel Elektronik" },
  "VESTEL": { symbol: "VESTL", exchange: "BIST", name: "Vestel Elektronik" },
  "KOZAL": { symbol: "KOZAL", exchange: "BIST", name: "Koza Altın" },
  "KOZAA": { symbol: "KOZAA", exchange: "BIST", name: "Koza Anadolu" },
  "ARCLK": { symbol: "ARCLK", exchange: "BIST", name: "Arçelik" },
  "ARCELIK": { symbol: "ARCLK", exchange: "BIST", name: "Arçelik" },
  "HEKTS": { symbol: "HEKTS", exchange: "BIST", name: "Hektaş" },
  "MGROS": { symbol: "MGROS", exchange: "BIST", name: "Migros" },
  "MIGROS": { symbol: "MGROS", exchange: "BIST", name: "Migros" },
  "FROTO": { symbol: "FROTO", exchange: "BIST", name: "Ford Otosan" },
  "FORD": { symbol: "FROTO", exchange: "BIST", name: "Ford Otosan" },
  "YKBNK": { symbol: "YKBNK", exchange: "BIST", name: "Yapı Kredi" },
  "YAPI KREDI": { symbol: "YKBNK", exchange: "BIST", name: "Yapı Kredi" },
  "YAPIKRED": { symbol: "YKBNK", exchange: "BIST", name: "Yapı Kredi" },

  // Döviz
  "USD":     { symbol: "USD/TRY", exchange: "FOREX", name: "Amerikan Doları" },
  "USD/TRY": { symbol: "USD/TRY", exchange: "FOREX", name: "Amerikan Doları" },
  "DOLAR":   { symbol: "USD/TRY", exchange: "FOREX", name: "Amerikan Doları" },
  "EUR":     { symbol: "EUR/TRY", exchange: "FOREX", name: "Euro" },
  "EUR/TRY": { symbol: "EUR/TRY", exchange: "FOREX", name: "Euro" },
  "EURO":    { symbol: "EUR/TRY", exchange: "FOREX", name: "Euro" },
  "GBP":     { symbol: "GBP/TRY", exchange: "FOREX", name: "İngiliz Sterlini" },
  "GBP/TRY": { symbol: "GBP/TRY", exchange: "FOREX", name: "İngiliz Sterlini" },

  // Altın
  "XAU":     { symbol: "XAU/USD", exchange: "COMMODITY", name: "Ons Altın (USD)" },
  "XAU/TRY": { symbol: "XAU/USD", exchange: "COMMODITY", name: "Ons Altın (USD)" },
  "XAU/USD": { symbol: "XAU/USD", exchange: "COMMODITY", name: "Ons Altın (USD)" },
  "ALTIN":   { symbol: "XAU/USD", exchange: "COMMODITY", name: "Ons Altın (USD)" },
  "GRAM ALTIN": { symbol: "XAU/USD", exchange: "COMMODITY", name: "Ons Altın (USD)" },

  // Kripto
  "BTC":      { symbol: "BTC/USD", exchange: "CRYPTO", name: "Bitcoin" },
  "BTC/USD":  { symbol: "BTC/USD", exchange: "CRYPTO", name: "Bitcoin" },
  "BITCOIN":  { symbol: "BTC/USD", exchange: "CRYPTO", name: "Bitcoin" },
  "ETH":      { symbol: "ETH/USD", exchange: "CRYPTO", name: "Ethereum" },
  "ETH/USD":  { symbol: "ETH/USD", exchange: "CRYPTO", name: "Ethereum" },
  "ETHEREUM": { symbol: "ETH/USD", exchange: "CRYPTO", name: "Ethereum" },
};

/* ─── Tipler ───────────────────────────────────────────────── */

export interface MarketPrice {
  symbol: string;
  name: string;
  price: number;
  change: number;        // günlük değişim (TRY veya USD)
  changePercent: number;  // günlük değişim %
  currency: string;
  updatedAt: string;
}

export interface MarketTimeSeries {
  symbol: string;
  interval: string;
  values: { datetime: string; close: number }[];
}

/* ─── In-Memory Cache ──────────────────────────────────────── */

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const priceCache = new Map<string, CacheEntry<MarketPrice>>();
const seriesCache = new Map<string, CacheEntry<MarketTimeSeries>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() });
}

/* ─── Fallback Fiyatlar (API yoksa) ────────────────────────── */

const FALLBACK_PRICES: Record<string, { price: number; name: string; currency: string }> = {
  "XAU/USD": { price: 2400, name: "Ons Altın", currency: "USD" },
  "USD/TRY": { price: 38.5, name: "Amerikan Doları", currency: "TRY" },
  "EUR/TRY": { price: 42.2, name: "Euro", currency: "TRY" },
  "GBP/TRY": { price: 49.5, name: "İngiliz Sterlini", currency: "TRY" },
  "BTC/USD": { price: 104000, name: "Bitcoin", currency: "USD" },
  "ETH/USD": { price: 3900, name: "Ethereum", currency: "USD" },
  "THYAO":   { price: 312, name: "Türk Hava Yolları", currency: "TRY" },
  "GARAN":   { price: 148, name: "Garanti BBVA", currency: "TRY" },
  "AKBNK":   { price: 62, name: "Akbank", currency: "TRY" },
  "ISCTR":   { price: 18, name: "İş Bankası C", currency: "TRY" },
  "SISE":    { price: 56, name: "Şişecam", currency: "TRY" },
  "ASELS":   { price: 78, name: "Aselsan", currency: "TRY" },
  "BIMAS":   { price: 540, name: "BİM Mağazaları", currency: "TRY" },
  "KCHOL":   { price: 210, name: "Koç Holding", currency: "TRY" },
};

/* ─── TwelveData API Fonksiyonları ─────────────────────────── */

/**
 * Tek sembol için güncel fiyat çek.
 */
export async function fetchPrice(rawSymbol: string): Promise<MarketPrice> {
  const key = getApiKey();
  const mapped = SYMBOL_MAP[rawSymbol.toUpperCase()] || { symbol: rawSymbol, exchange: "", name: rawSymbol };
  const symbol = mapped.symbol;

  // Cache kontrol
  const cached = getCached(priceCache, symbol);
  if (cached) return cached;

  // API yoksa fallback
  if (!key) {
    console.warn(`[market] TwelveData API key yok, fallback kullanılıyor: ${symbol}`);
    return buildFallback(symbol, mapped.name);
  }

  try {
    const url = `${TWELVEDATA_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      console.error(`[market] TwelveData HTTP ${res.status} for ${symbol}`);
      return buildFallback(symbol, mapped.name);
    }

    const data = await res.json();

    if (data.status === "error" || data.code) {
      console.error(`[market] TwelveData error for ${symbol}:`, data.message || data.code);
      return buildFallback(symbol, mapped.name);
    }

    const price: MarketPrice = {
      symbol,
      name: data.name || mapped.name,
      price: parseFloat(data.close) || 0,
      change: parseFloat(data.change) || 0,
      changePercent: parseFloat(data.percent_change) || 0,
      currency: data.currency || "TRY",
      updatedAt: new Date().toISOString(),
    };

    setCache(priceCache, symbol, price);
    return price;
  } catch (err) {
    console.error(`[market] fetchPrice error for ${symbol}:`, err);
    return buildFallback(symbol, mapped.name);
  }
}

/**
 * Birden fazla sembol için toplu fiyat çek.
 */
export async function fetchPrices(rawSymbols: string[]): Promise<Record<string, MarketPrice>> {
  const result: Record<string, MarketPrice> = {};

  // Önce cache'den al
  const toFetch: string[] = [];
  for (const raw of rawSymbols) {
    const mapped = SYMBOL_MAP[raw.toUpperCase()] || { symbol: raw, exchange: "", name: raw };
    const cached = getCached(priceCache, mapped.symbol);
    if (cached) {
      result[mapped.symbol] = cached;
    } else {
      toFetch.push(raw);
    }
  }

  if (toFetch.length === 0) return result;

  const key = getApiKey();
  if (!key) {
    // Hepsi fallback
    for (const raw of toFetch) {
      const mapped = SYMBOL_MAP[raw.toUpperCase()] || { symbol: raw, exchange: "", name: raw };
      result[mapped.symbol] = buildFallback(mapped.symbol, mapped.name);
    }
    return result;
  }

  // TwelveData batch: symbol=THYAO,GARAN,USD/TRY
  const symbols = toFetch.map(r => {
    const m = SYMBOL_MAP[r.toUpperCase()];
    return m ? m.symbol : r;
  });

  try {
    const url = `${TWELVEDATA_BASE}/quote?symbol=${symbols.join(",")}&apikey=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!res.ok) {
      console.error(`[market] batch quote HTTP ${res.status}`);
      for (const sym of symbols) {
        result[sym] = buildFallback(sym, SYMBOL_MAP[sym]?.name || sym);
      }
      return result;
    }

    const data = await res.json();

    // Tek sembol → obje, çoklu → anahtar-değer
    if (symbols.length === 1) {
      const sym = symbols[0]!;
      if (data.close) {
        const p: MarketPrice = {
          symbol: sym,
          name: data.name || sym,
          price: parseFloat(data.close) || 0,
          change: parseFloat(data.change) || 0,
          changePercent: parseFloat(data.percent_change) || 0,
          currency: data.currency || "TRY",
          updatedAt: new Date().toISOString(),
        };
        setCache(priceCache, sym, p);
        result[sym] = p;
      } else {
        result[sym] = buildFallback(sym, sym);
      }
    } else {
      for (const sym of symbols) {
        const item = data[sym];
        if (item && item.close && !item.code) {
          const p: MarketPrice = {
            symbol: sym,
            name: item.name || sym,
            price: parseFloat(item.close) || 0,
            change: parseFloat(item.change) || 0,
            changePercent: parseFloat(item.percent_change) || 0,
            currency: item.currency || "TRY",
            updatedAt: new Date().toISOString(),
          };
          setCache(priceCache, sym, p);
          result[sym] = p;
        } else {
          result[sym] = buildFallback(sym, sym);
        }
      }
    }
  } catch (err) {
    console.error("[market] batch quote error:", err);
    for (const sym of symbols) {
      result[sym] = buildFallback(sym, sym);
    }
  }

  return result;
}

/**
 * Zaman serisi verisi çek (sparkline chart için).
 */
export async function fetchTimeSeries(
  rawSymbol: string,
  interval: string = "1day",
  outputSize: number = 30,
): Promise<MarketTimeSeries> {
  const mapped = SYMBOL_MAP[rawSymbol.toUpperCase()] || { symbol: rawSymbol, exchange: "", name: rawSymbol };
  const symbol = mapped.symbol;
  const cacheKey = `${symbol}_${interval}_${outputSize}`;

  const cached = getCached(seriesCache, cacheKey);
  if (cached) return cached;

  const key = getApiKey();
  if (!key) {
    return buildFallbackSeries(symbol, outputSize);
  }

  try {
    const url = `${TWELVEDATA_BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputSize}&apikey=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!res.ok) {
      return buildFallbackSeries(symbol, outputSize);
    }

    const data = await res.json();
    if (data.status === "error" || !data.values) {
      return buildFallbackSeries(symbol, outputSize);
    }

    const series: MarketTimeSeries = {
      symbol,
      interval,
      values: data.values.map((v: { datetime: string; close: string }) => ({
        datetime: v.datetime,
        close: parseFloat(v.close),
      })).reverse(), // eskiden yeniye
    };

    setCache(seriesCache, cacheKey, series);
    return series;
  } catch (err) {
    console.error(`[market] timeSeries error for ${symbol}:`, err);
    return buildFallbackSeries(symbol, outputSize);
  }
}

/* ─── Varlık Fiyat Güncelleme ──────────────────────────────── */

/** Varlık ticker'ına göre TwelveData'dan güncel fiyat çek */
export async function resolveAssetPrice(ticker: string | undefined, assetType: string): Promise<number | null> {
  if (!ticker) return null;

  const upperTicker = ticker.toUpperCase().replace(".IS", "");
  const mapped = SYMBOL_MAP[upperTicker];
  if (!mapped) return null;

  try {
    const mp = await fetchPrice(upperTicker);
    if (!mp || mp.price <= 0) return null;

    // Altın: XAU/USD → gram TRY'ye çevir
    if (assetType === "altın" && mapped.symbol === "XAU/USD") {
      const usdTry = await fetchPrice("USD/TRY");
      const gramPrice = (mp.price / 31.1035) * usdTry.price; // ons → gram → TRY
      return Math.round(gramPrice * 100) / 100;
    }

    // Kripto: USD → TRY
    if (assetType === "kripto" && mp.currency === "USD") {
      const usdTry = await fetchPrice("USD/TRY");
      return Math.round(mp.price * usdTry.price * 100) / 100;
    }

    // Döviz: zaten TRY
    return Math.round(mp.price * 100) / 100;
  } catch (err) {
    console.error(`[market] resolveAssetPrice error for ${ticker}:`, err);
    return null;
  }
}

/* ─── AI için Piyasa Özeti ─────────────────────────────────── */

export async function getMarketSummaryForAI(): Promise<string> {
  const defaultSymbols = ["USD/TRY", "EUR/TRY", "XAU/USD", "BTC/USD", "THYAO", "GARAN"];
  const prices = await fetchPrices(defaultSymbols);

  const lines: string[] = ["GÜNCEL PİYASA VERİLERİ (TwelveData)"];
  for (const [sym, p] of Object.entries(prices)) {
    const dir = p.changePercent > 0 ? "↑" : p.changePercent < 0 ? "↓" : "→";
    lines.push(`  ${p.name} (${sym}): ${p.price.toLocaleString("tr-TR")} ${p.currency} ${dir} %${p.changePercent.toFixed(2)}`);
  }
  return lines.join("\n");
}

/* ─── Yardımcılar ──────────────────────────────────────────── */

function buildFallback(symbol: string, name: string): MarketPrice {
  const fb = FALLBACK_PRICES[symbol];
  return {
    symbol,
    name: fb?.name || name || symbol,
    price: fb?.price || 0,
    change: 0,
    changePercent: 0,
    currency: fb?.currency || "TRY",
    updatedAt: new Date().toISOString(),
  };
}

function buildFallbackSeries(symbol: string, count: number): MarketTimeSeries {
  const fb = FALLBACK_PRICES[symbol];
  const basePrice = fb?.price || 100;
  const values: { datetime: string; close: number }[] = [];
  const now = new Date();

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const noise = (Math.random() - 0.5) * basePrice * 0.03;
    values.push({
      datetime: d.toISOString().split("T")[0]!,
      close: Math.round((basePrice + noise) * 100) / 100,
    });
  }

  return { symbol, interval: "1day", values };
}

/** Sembol çözümleme: doğal dil → TwelveData sembolü */
export function resolveSymbol(input: string): { symbol: string; name: string; exchange: string } | null {
  const upper = input.toUpperCase().trim();
  const mapped = SYMBOL_MAP[upper];
  if (mapped) return mapped;

  // Kısmi eşleştirme
  for (const [key, val] of Object.entries(SYMBOL_MAP)) {
    if (key.includes(upper) || val.name.toUpperCase().includes(upper)) {
      return val;
    }
  }

  return null;
}
