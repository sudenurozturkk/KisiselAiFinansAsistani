import { describe, expect, it } from "vitest";
import { parsePrice } from "./scraper";

describe("parsePrice", () => {
  it("Türkçe formatı doğru parse eder (1.299,99)", () => {
    expect(parsePrice("1.299,99")).toBe(1299.99);
    expect(parsePrice("12.999,50 TL")).toBe(12999.5);
    expect(parsePrice("₺1.299,00")).toBe(1299);
  });

  it("İngilizce formatı doğru parse eder (1,299.99)", () => {
    expect(parsePrice("1,299.99")).toBe(1299.99);
    expect(parsePrice("$1,299.99")).toBe(1299.99);
  });

  it("ondalıksız sayıları parse eder", () => {
    expect(parsePrice("499")).toBe(499);
    expect(parsePrice("499 TL")).toBe(499);
    expect(parsePrice("₺2500")).toBe(2500);
  });

  it("number girdiyi olduğu gibi döner; 0 ve negatifi reddeder", () => {
    expect(parsePrice(123.45)).toBe(123.45);
    expect(parsePrice(0)).toBeUndefined();
    expect(parsePrice(-50)).toBeUndefined();
  });

  it("geçersiz veya boş girdiler için undefined döner", () => {
    expect(parsePrice("")).toBeUndefined();
    expect(parsePrice("abc")).toBeUndefined();
    expect(parsePrice(null)).toBeUndefined();
    expect(parsePrice(undefined)).toBeUndefined();
    expect(parsePrice(NaN)).toBeUndefined();
  });

  it("binlik ayırıcı olmayan İngilizce: 1299.99", () => {
    expect(parsePrice("1299.99")).toBe(1299.99);
  });

  it("sadece Türkçe ondalık: 49,90", () => {
    expect(parsePrice("49,90")).toBe(49.9);
  });
});
