/**
 * Ürün URL Scraper
 *
 * Hedef: Trendyol, Hepsiburada, Amazon, n11, Sahibinden, GittiGidiyor gibi
 * popüler Türk e-ticaret sitelerinden ürün bilgilerini çekmek.
 *
 * Strateji (sıralı denemeler):
 *  1. JSON-LD structured data (en güvenilir, schema.org/Product)
 *  2. Open Graph meta tagları (og:title, og:image, og:price:amount)
 *  3. Twitter Card meta tagları
 *  4. Site-spesifik regex desenleri (fallback)
 *
 * Tasarım kararları:
 *  - Sunucu tarafı (CORS yok, User-Agent set edebilir)
 *  - 8s timeout (uzun sayfalar için)
 *  - HTML body'i ilk 200KB ile sınırlı (DDoS koruması)
 *  - Hata fırlatmaz, mümkün olduğunca kısmi sonuç döner
 */

import type { ProductScrapeData } from "./types";

const MAX_BYTES = 200_000;
const TIMEOUT_MS = 8_000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/* ─── Yardımcı: HTML decode (entities) ─────────────────────── */

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
  "&Auml;": "Ä",
  "&ouml;": "ö",
  "&Ouml;": "Ö",
  "&uuml;": "ü",
  "&Uuml;": "Ü",
  "&ccedil;": "ç",
  "&Ccedil;": "Ç",
  "&#252;": "ü",
  "&#246;": "ö",
  "&#231;": "ç",
  "&#287;": "ğ",
  "&#286;": "Ğ",
  "&#351;": "ş",
  "&#350;": "Ş",
  "&#305;": "ı",
  "&#304;": "İ",
};

function decodeHtml(s: string): string {
  if (!s) return s;
  return s
    .replace(/&#(\d+);/g, (_, num) => {
      const n = Number(num);
      return Number.isFinite(n) && n > 0 && n < 0x10ffff
        ? String.fromCodePoint(n)
        : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&[a-z]+;/gi, (m) => HTML_ENTITIES[m] ?? m);
}

/* ─── Yardımcı: Fiyatı string'den parse et ─────────────────── */

/**
 * "1.299,99 TL" → 1299.99
 * "₺2,499.50"   → 2499.50
 * "499 TL"      → 499
 *
 * Türkçe (1.299,99) ve İngilizce (1,299.99) format ayrımını otomatik yapar.
 */
export function parsePrice(
  raw: string | number | undefined | null,
): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? raw : undefined;
  }

  const s = String(raw).trim();
  if (!s) return undefined;

  // Sadece rakam, ',' ve '.' kalsın
  const cleaned = s.replace(/[^\d.,-]/g, "");
  if (!cleaned) return undefined;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized: string;
  if (lastComma === -1 && lastDot === -1) {
    normalized = cleaned;
  } else if (lastComma > lastDot) {
    // Türkçe format: 1.299,99 → 1299.99
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // İngilizce format: 1,299.99 → 1299.99
    normalized = cleaned.replace(/,/g, "");
  }

  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
}

/* ─── HTTP fetch with timeout & size limit ─────────────────── */

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    // Stream'i baytlarla sınırla
    const reader = res.body?.getReader();
    if (!reader) return await res.text();

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.length;
      if (total >= MAX_BYTES) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        break;
      }
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    // UTF-8 varsayılan; meta charset farklı olsa bile genel siteler UTF-8 kullanır
    return new TextDecoder("utf-8", { fatal: false }).decode(merged);
  } finally {
    clearTimeout(timer);
  }
}

/* ─── Strateji 1: JSON-LD ──────────────────────────────────── */

interface JsonLdProduct {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  image?: string | string[] | { url?: string };
  brand?: string | { name?: string };
  offers?: JsonLdOffer | JsonLdOffer[];
}

interface JsonLdOffer {
  "@type"?: string;
  price?: string | number;
  priceCurrency?: string;
  availability?: string;
}

function extractJsonLd(html: string): JsonLdProduct[] {
  const results: JsonLdProduct[] = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (!m[1]) continue;
    const raw = m[1].trim();
    try {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of arr) {
        if (!node || typeof node !== "object") continue;
        // @graph içindekileri de tara
        if (Array.isArray(node["@graph"])) {
          for (const g of node["@graph"]) {
            if (isProduct(g)) results.push(g);
          }
        }
        if (isProduct(node)) results.push(node);
      }
    } catch {
      /* parse error — atla */
    }
  }
  return results;
}

function isProduct(node: unknown): node is JsonLdProduct {
  if (!node || typeof node !== "object") return false;
  const t = (node as { "@type"?: string | string[] })["@type"];
  if (!t) return false;
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => String(x).toLowerCase().includes("product"));
}

function jsonLdToScrape(prod: JsonLdProduct, url: string): ProductScrapeData {
  const out: ProductScrapeData = { url };

  if (typeof prod.name === "string") out.name = decodeHtml(prod.name).trim();
  if (typeof prod.description === "string")
    out.description = decodeHtml(prod.description).trim().slice(0, 500);

  // Image
  if (typeof prod.image === "string") out.imageUrl = prod.image;
  else if (Array.isArray(prod.image) && typeof prod.image[0] === "string")
    out.imageUrl = prod.image[0];
  else if (
    prod.image &&
    typeof prod.image === "object" &&
    "url" in prod.image &&
    typeof prod.image.url === "string"
  )
    out.imageUrl = prod.image.url;

  // Brand
  if (typeof prod.brand === "string") out.brand = decodeHtml(prod.brand);
  else if (prod.brand && typeof prod.brand === "object" && prod.brand.name)
    out.brand = decodeHtml(prod.brand.name);

  // Offer (price)
  const offers = Array.isArray(prod.offers)
    ? prod.offers
    : prod.offers
      ? [prod.offers]
      : [];
  for (const off of offers) {
    if (!off) continue;
    if (out.price === undefined) {
      const p = parsePrice(off.price);
      if (p !== undefined) out.price = p;
    }
    if (!out.currency && off.priceCurrency) out.currency = off.priceCurrency;
    if (!out.availability && off.availability)
      out.availability = off.availability;
  }

  return out;
}

/* ─── Strateji 2: Open Graph / Meta tags ───────────────────── */

function extractMeta(html: string, names: string[]): string | undefined {
  for (const name of names) {
    // <meta property="og:title" content="..."> veya name="..."
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*content=["']([^"']*)["']`,
      "i",
    );
    const m = re.exec(html);
    if (m && m[1]) return decodeHtml(m[1]).trim();

    // content önce, name sonra (bazı siteler tersine yazar)
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
      "i",
    );
    const m2 = re2.exec(html);
    if (m2 && m2[1]) return decodeHtml(m2[1]).trim();
  }
  return undefined;
}

function extractTitle(html: string): string | undefined {
  const m = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  return m && m[1] ? decodeHtml(m[1]).trim() : undefined;
}

function extractFromMeta(html: string, url: string): ProductScrapeData {
  const out: ProductScrapeData = { url };

  out.name =
    extractMeta(html, ["og:title", "twitter:title", "title"]) ??
    extractTitle(html);

  out.description = extractMeta(html, [
    "og:description",
    "twitter:description",
    "description",
  ]);
  if (out.description) out.description = out.description.slice(0, 500);

  out.imageUrl = extractMeta(html, [
    "og:image",
    "og:image:secure_url",
    "twitter:image",
    "twitter:image:src",
  ]);

  out.siteName = extractMeta(html, ["og:site_name"]);

  const priceRaw =
    extractMeta(html, [
      "product:price:amount",
      "og:price:amount",
      "twitter:data1",
      "price",
    ]) ?? undefined;
  if (priceRaw) {
    const p = parsePrice(priceRaw);
    if (p !== undefined) out.price = p;
  }

  const currency = extractMeta(html, [
    "product:price:currency",
    "og:price:currency",
  ]);
  if (currency) out.currency = currency;

  return out;
}

/* ─── Strateji 3: Site-spesifik fiyat regex ────────────────── */

const PRICE_REGEXES: { host: RegExp; pattern: RegExp }[] = [
  // Trendyol: <span class="prc-dsc">1.299,99 TL</span>
  {
    host: /trendyol\.com/,
    pattern:
      /class=["'](?:prc-dsc|product-price|prc-slg)[^"']*["'][^>]*>([^<]+)</i,
  },
  // Hepsiburada: data-price="..."
  {
    host: /hepsiburada\.com/,
    pattern: /data-price=["']([^"']+)["']/i,
  },
  // n11: ins class="newPrice"
  {
    host: /n11\.com/,
    pattern: /class=["']newPrice["'][^>]*>([\s\S]*?)<\/ins>/i,
  },
  // Amazon: span class="a-price-whole"
  {
    host: /amazon\./,
    pattern: /class=["']a-offscreen["'][^>]*>([^<]+)</i,
  },
];

function extractSiteSpecific(
  html: string,
  url: string,
): Partial<ProductScrapeData> {
  const out: Partial<ProductScrapeData> = {};
  for (const { host, pattern } of PRICE_REGEXES) {
    if (!host.test(url)) continue;
    const m = pattern.exec(html);
    if (m && m[1]) {
      const p = parsePrice(m[1]);
      if (p !== undefined) {
        out.price = p;
        break;
      }
    }
  }
  return out;
}

/* ─── Site adı (host'tan) ──────────────────────────────────── */

function deriveSiteName(url: string): string | undefined {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const lookup: Record<string, string> = {
      "trendyol.com": "Trendyol",
      "hepsiburada.com": "Hepsiburada",
      "amazon.com.tr": "Amazon TR",
      "amazon.com": "Amazon",
      "n11.com": "n11",
      "sahibinden.com": "Sahibinden",
      "gittigidiyor.com": "GittiGidiyor",
      "morhipo.com": "Morhipo",
      "boyner.com.tr": "Boyner",
      "lcwaikiki.com": "LC Waikiki",
      "vatanbilgisayar.com": "Vatan Bilgisayar",
      "teknosa.com": "Teknosa",
      "mediamarkt.com.tr": "MediaMarkt",
    };
    for (const [key, name] of Object.entries(lookup)) {
      if (host.endsWith(key)) return name;
    }
    return host
      .split(".")[0]
      ?.replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return undefined;
  }
}

/* ─── Public API ───────────────────────────────────────────── */

/**
 * URL'den ürün bilgilerini çek. Tüm stratejileri birleştirir,
 * en yüksek doğruluklu kaynak öncelikli.
 */
export async function scrapeProductUrl(
  url: string,
): Promise<ProductScrapeData> {
  // URL doğrula
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("Geçersiz URL");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Sadece http(s) destekleniyor");
  }

  const html = await fetchHtml(url);

  // 1. JSON-LD (en güvenilir)
  const ldProducts = extractJsonLd(html);
  let result: ProductScrapeData = { url };
  if (ldProducts.length > 0 && ldProducts[0]) {
    result = jsonLdToScrape(ldProducts[0], url);
  }

  // 2. Meta tagları ile boş alanları doldur
  const meta = extractFromMeta(html, url);
  result = mergePreferFirst(result, meta);

  // 3. Fiyat hâlâ yoksa site-specific regex
  if (result.price === undefined) {
    const siteData = extractSiteSpecific(html, url);
    if (siteData.price !== undefined) result.price = siteData.price;
  }

  // 4. Site adı derive et
  if (!result.siteName) result.siteName = deriveSiteName(url);

  // Mutlak URL'e dönüştür (image)
  if (result.imageUrl && result.imageUrl.startsWith("//")) {
    result.imageUrl = `${parsedUrl.protocol}${result.imageUrl}`;
  } else if (result.imageUrl && result.imageUrl.startsWith("/")) {
    result.imageUrl = `${parsedUrl.protocol}//${parsedUrl.host}${result.imageUrl}`;
  }

  // Title temizliği: "Ürün Adı - Site Adı" gibi suffix'leri çöz
  if (result.name && result.siteName) {
    const suffix = new RegExp(
      `\\s*[\\-|\\—|\\|]\\s*${escapeRe(result.siteName)}\\s*$`,
      "i",
    );
    result.name = result.name.replace(suffix, "").trim();
  }

  return result;
}

function mergePreferFirst(
  a: ProductScrapeData,
  b: ProductScrapeData,
): ProductScrapeData {
  const out = { ...a } as Record<string, unknown>;
  for (const [k, v] of Object.entries(
    b as unknown as Record<string, unknown>,
  )) {
    if (v === undefined || v === null || v === "") continue;
    const cur = out[k];
    if (cur === undefined || cur === null || cur === "") {
      out[k] = v;
    }
  }
  return out as unknown as ProductScrapeData;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
