/**
 * Playwright Headless Browser Scraper — Agentic Ürün Veri Çekme
 *
 * Trendyol, Hepsiburada, Amazon gibi CSR sitelerde fetch ile veri çekilemez.
 * Playwright ile gerçek bir tarayıcı gibi davranarak JS render edip veri çekeriz.
 *
 * Hackathon Agentic Yapılar kriteri: AI Agent bu modülü "tool" olarak kullanır.
 */

import { chromium, type Browser, type Page } from "playwright";
import type { ProductScrapeData } from "./types";

/* ─── Singleton Browser ─────────────────────────────────────── */

let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance?.isConnected()) return browserInstance;
  if (!browserLaunchPromise) {
    browserLaunchPromise = chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--disable-extensions"],
    });
  }
  try {
    browserInstance = await browserLaunchPromise;
    console.log("[playwright] Browser başlatıldı");
    return browserInstance;
  } finally {
    browserLaunchPromise = null;
  }
}

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
}

/* ─── Null → Undefined helper (page.evaluate returns null for missing DOM) ── */

function n2u<T>(v: T | null): T | undefined { return v === null ? undefined : v; }

/* ─── Site-Specific Strategies ─────────────────────────────── */

interface SiteStrategy {
  match: (url: string) => boolean;
  extract: (page: Page) => Promise<Partial<ProductScrapeData>>;
}

const STRATEGIES: SiteStrategy[] = [
  // ── Trendyol ──
  {
    match: (url) => url.includes("trendyol.com"),
    extract: async (page) => {
      await page.waitForSelector(".pr-new-br h1, .product-title", { timeout: 8000 }).catch(() => {});
      const r = await page.evaluate(() => ({
        name: document.querySelector(".pr-new-br h1")?.textContent?.trim() || document.querySelector("h1")?.textContent?.trim() || null,
        price: (() => { const t = (document.querySelector(".prc-dsc") || document.querySelector(".prc-slg"))?.textContent?.replace(/[^\d,.]/g, ""); return t ? parseFloat(t.replace(".", "").replace(",", ".")) : null; })(),
        originalPrice: (() => { const t = document.querySelector(".prc-org")?.textContent?.replace(/[^\d,.]/g, ""); return t ? parseFloat(t.replace(".", "").replace(",", ".")) : null; })(),
        brand: document.querySelector(".pr-new-br a")?.textContent?.trim() || null,
        imageUrl: (document.querySelector(".base-product-image img") as HTMLImageElement)?.src || document.querySelector('meta[property="og:image"]')?.getAttribute("content") || null,
        description: document.querySelector(".detail-desc-list")?.textContent?.trim()?.slice(0, 300) || document.querySelector('meta[name="description"]')?.getAttribute("content") || null,
        siteName: "Trendyol",
        currency: "TRY",
      }));
      return { name: n2u(r.name), price: n2u(r.price), brand: n2u(r.brand), imageUrl: n2u(r.imageUrl), description: n2u(r.description), siteName: r.siteName, currency: r.currency };
    },
  },

  // ── Hepsiburada ──
  {
    match: (url) => url.includes("hepsiburada.com"),
    extract: async (page) => {
      await page.waitForSelector("#product-name, [data-test-id='product-name']", { timeout: 8000 }).catch(() => {});
      const r = await page.evaluate(() => ({
        name: document.getElementById("product-name")?.textContent?.trim() || document.querySelector("h1")?.textContent?.trim() || null,
        price: (() => { const t = (document.querySelector("[data-test-id='price-current-price']") || document.querySelector(".product-price"))?.textContent?.replace(/[^\d,.]/g, ""); return t ? parseFloat(t.replace(".", "").replace(",", ".")) : null; })(),
        brand: document.querySelector("[data-test-id='product-brand']")?.textContent?.trim() || null,
        imageUrl: (document.querySelector(".product-image img") as HTMLImageElement)?.src || document.querySelector('meta[property="og:image"]')?.getAttribute("content") || null,
        description: document.querySelector('meta[name="description"]')?.getAttribute("content") || null,
        siteName: "Hepsiburada",
        currency: "TRY",
      }));
      return { name: n2u(r.name), price: n2u(r.price), brand: n2u(r.brand), imageUrl: n2u(r.imageUrl), description: n2u(r.description), siteName: r.siteName, currency: r.currency };
    },
  },

  // ── Udemy ──
  {
    match: (url) => url.includes("udemy.com"),
    extract: async (page) => {
      await page.waitForSelector("[data-purpose='lead-title'], h1", { timeout: 8000 }).catch(() => {});
      const r = await page.evaluate(() => ({
        name: document.querySelector("[data-purpose='lead-title']")?.textContent?.trim() || document.querySelector("h1")?.textContent?.trim() || null,
        price: (() => { const t = document.querySelector("[data-purpose='course-price-text'] span span")?.textContent?.replace(/[^\d,.]/g, ""); return t ? parseFloat(t.replace(".", "").replace(",", ".")) : null; })(),
        originalPrice: (() => { const t = document.querySelector("[data-purpose='original-price-container'] s span")?.textContent?.replace(/[^\d,.]/g, ""); return t ? parseFloat(t.replace(".", "").replace(",", ".")) : null; })(),
        brand: document.querySelector("[class*='instructor'] a")?.textContent?.trim() || null,
        imageUrl: document.querySelector('meta[property="og:image"]')?.getAttribute("content") || null,
        description: document.querySelector("[data-purpose='lead-headline']")?.textContent?.trim() || document.querySelector('meta[name="description"]')?.getAttribute("content") || null,
        siteName: "Udemy",
        currency: "TRY",
      }));
      return { name: n2u(r.name), price: n2u(r.price), brand: n2u(r.brand), imageUrl: n2u(r.imageUrl), description: n2u(r.description), siteName: r.siteName, currency: r.currency };
    },
  },

  // ── D&R ──
  {
    match: (url) => url.includes("dr.com.tr"),
    extract: async (page) => {
      await page.waitForSelector(".prd-name, h1", { timeout: 8000 }).catch(() => {});
      const r = await page.evaluate(() => ({
        name: document.querySelector(".prd-name")?.textContent?.trim() || document.querySelector("h1")?.textContent?.trim() || null,
        price: (() => { const t = (document.querySelector(".prd-price") || document.querySelector(".discountedPrice"))?.textContent?.replace(/[^\d,.]/g, ""); return t ? parseFloat(t.replace(".", "").replace(",", ".")) : null; })(),
        brand: document.querySelector(".prd-author")?.textContent?.trim() || null,
        imageUrl: (document.querySelector(".prd-image img") as HTMLImageElement)?.src || document.querySelector('meta[property="og:image"]')?.getAttribute("content") || null,
        description: document.querySelector('meta[name="description"]')?.getAttribute("content") || null,
        siteName: "D&R",
        currency: "TRY",
      }));
      return { name: n2u(r.name), price: n2u(r.price), brand: n2u(r.brand), imageUrl: n2u(r.imageUrl), description: n2u(r.description), siteName: r.siteName, currency: r.currency };
    },
  },

  // ── Amazon ──
  {
    match: (url) => url.includes("amazon."),
    extract: async (page) => {
      await page.waitForSelector("#productTitle, #title", { timeout: 8000 }).catch(() => {});
      const r = await page.evaluate(() => {
        const priceWhole = document.querySelector(".a-price-whole")?.textContent?.replace(/[^\d]/g, "");
        const priceFraction = document.querySelector(".a-price-fraction")?.textContent?.replace(/[^\d]/g, "") || "0";
        const currencyMap: Record<string, string> = { "₺": "TRY", "$": "USD", "€": "EUR", "£": "GBP", "zł": "PLN" };
        return {
          name: document.getElementById("productTitle")?.textContent?.trim() || null,
          price: priceWhole ? parseFloat(`${priceWhole}.${priceFraction}`) : null,
          brand: document.getElementById("bylineInfo")?.textContent?.trim()?.replace(/^(Marka|Brand|by):?\s*/i, "") || null,
          imageUrl: (document.getElementById("landingImage") as HTMLImageElement)?.src || document.querySelector('meta[property="og:image"]')?.getAttribute("content") || null,
          description: document.querySelector("#feature-bullets")?.textContent?.trim()?.slice(0, 300) || null,
          siteName: "Amazon",
          currency: currencyMap[document.querySelector(".a-price-symbol")?.textContent?.trim() || ""] || "TRY",
        };
      });
      return { name: n2u(r.name), price: n2u(r.price), brand: n2u(r.brand), imageUrl: n2u(r.imageUrl), description: n2u(r.description), siteName: r.siteName, currency: r.currency };
    },
  },
];

/* ─── Generic OG/JSON-LD fallback ──────────────────────────── */

async function genericExtract(page: Page): Promise<Partial<ProductScrapeData>> {
  const r = await page.evaluate(() => {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(script.textContent || "");
        const product = data["@type"] === "Product" ? data : (data["@graph"] as Array<Record<string, unknown>> | undefined)?.find((i) => i["@type"] === "Product");
        if (product) {
          const offer = (product.offers as Record<string, unknown>) || ((product.offers as Record<string, unknown>[])?.[0]);
          return {
            name: (product.name as string) || null,
            price: offer?.price ? Number(offer.price) : null,
            brand: ((product.brand as Record<string, string>)?.name || product.brand) as string | null,
            imageUrl: (Array.isArray(product.image) ? product.image[0] : product.image) as string | null,
            description: ((product.description as string)?.slice(0, 300)) || null,
            currency: (offer?.priceCurrency as string) || "TRY",
            siteName: null as string | null,
          };
        }
      } catch { /* skip */ }
    }
    const og = (p: string) => document.querySelector(`meta[property="${p}"]`)?.getAttribute("content") || null;
    const meta = (n: string) => document.querySelector(`meta[name="${n}"]`)?.getAttribute("content") || null;
    const priceStr = og("product:price:amount") || og("og:price:amount");
    return {
      name: og("og:title") || document.querySelector("h1")?.textContent?.trim() || null,
      price: priceStr ? parseFloat(priceStr) : null,
      imageUrl: og("og:image"),
      description: og("og:description") || meta("description"),
      siteName: og("og:site_name"),
      currency: og("product:price:currency") || "TRY",
      brand: null as string | null,
    };
  });
  return { name: n2u(r.name), price: n2u(r.price), brand: n2u(r.brand), imageUrl: n2u(r.imageUrl), description: n2u(r.description), siteName: n2u(r.siteName), currency: r.currency };
}

/* ─── Ana Scrape Fonksiyonu ─────────────────────────────────── */

const SCRAPE_TIMEOUT = 15_000;

export async function scrapeWithPlaywright(url: string): Promise<ProductScrapeData> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "tr-TR",
  });
  const page = await context.newPage();
  const result: ProductScrapeData = { url };

  try {
    await page.route("**/*.{png,jpg,jpeg,gif,svg,webp,woff,woff2,ttf}", (route) => route.abort());
    await page.route("**/analytics**", (route) => route.abort());
    await page.route("**/tracking**", (route) => route.abort());
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: SCRAPE_TIMEOUT });
    await page.waitForTimeout(2000);

    const strategy = STRATEGIES.find((s) => s.match(url));
    let extracted: Partial<ProductScrapeData> = {};

    if (strategy) {
      try { extracted = await strategy.extract(page); }
      catch (e) { console.warn(`[playwright] Site strateji başarısız:`, e); }
    }

    if (!extracted.name || !extracted.price) {
      const generic = await genericExtract(page);
      for (const [key, value] of Object.entries(generic)) {
        if (!extracted[key as keyof ProductScrapeData] && value) {
          (extracted as Record<string, unknown>)[key] = value;
        }
      }
    }

    Object.assign(result, extracted);
    console.log(`[playwright] ✓ ${result.name?.slice(0, 50) || "?"} — ${result.price ?? "fiyat yok"} ${result.currency ?? ""}`);
  } catch (err) {
    console.error(`[playwright] Hata (${url}):`, err);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
  return result;
}

export async function checkStockStatus(url: string): Promise<{ inStock: boolean; price?: number }> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    locale: "tr-TR",
  });
  const page = await context.newPage();
  try {
    await page.route("**/*.{png,jpg,jpeg,gif,svg,webp,woff,woff2}", (route) => route.abort());
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: SCRAPE_TIMEOUT });
    await page.waitForTimeout(2000);
    const { inStock } = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return { inStock: !text.includes("tükendi") && !text.includes("stokta yok") && !text.includes("out of stock") };
    });
    const strategy = STRATEGIES.find((s) => s.match(url));
    let price: number | undefined;
    if (strategy) { const d = await strategy.extract(page).catch(() => ({} as Partial<ProductScrapeData>)); price = d.price; }
    return { inStock, price };
  } catch { return { inStock: true }; }
  finally { await page.close().catch(() => {}); await context.close().catch(() => {}); }
}
