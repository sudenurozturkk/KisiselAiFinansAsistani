import { describe, expect, it } from "vitest";
import {
  isNumber,
  isPositive,
  isUrl,
  matches,
  maxLength,
  maxNumber,
  minLength,
  minNumber,
  oneOf,
  required,
  validate,
  validateForm,
} from "./validation";

describe("required", () => {
  it("boş değerlerde hata verir", () => {
    expect(required()(null)).not.toBeNull();
    expect(required()(undefined)).not.toBeNull();
    expect(required()("")).not.toBeNull();
    expect(required()("   ")).not.toBeNull();
    expect(required()([])).not.toBeNull();
  });

  it("dolu değerlerde geçer", () => {
    expect(required()("foo")).toBeNull();
    expect(required()(0)).toBeNull();
    expect(required()(["a"])).toBeNull();
  });
});

describe("number kuralları", () => {
  it("isNumber sayı olmayan string'e hata verir", () => {
    expect(isNumber()("abc")).not.toBeNull();
  });
  it("isNumber boş string'i kabul eder (required işi)", () => {
    expect(isNumber()("")).toBeNull();
  });
  it("minNumber alt sınırı zorlar", () => {
    expect(minNumber(10)("5")).not.toBeNull();
    expect(minNumber(10)(15)).toBeNull();
  });
  it("maxNumber üst sınırı zorlar", () => {
    expect(maxNumber(100)("200")).not.toBeNull();
    expect(maxNumber(100)(50)).toBeNull();
  });
  it("isPositive negatifte hata verir", () => {
    expect(isPositive()(-1)).not.toBeNull();
    expect(isPositive()(0)).not.toBeNull();
    expect(isPositive()(1)).toBeNull();
  });
});

describe("string kuralları", () => {
  it("minLength/maxLength çalışır", () => {
    expect(minLength(3)("ab")).not.toBeNull();
    expect(minLength(3)("abc")).toBeNull();
    expect(maxLength(3)("abcd")).not.toBeNull();
  });
  it("matches regex doğrular", () => {
    expect(matches(/^\d+$/, "Sayı olmalı")("12a")).toBe("Sayı olmalı");
    expect(matches(/^\d+$/, "Sayı olmalı")("123")).toBeNull();
  });
});

describe("isUrl", () => {
  it("geçersiz URL'de hata verir", () => {
    expect(isUrl()("not-a-url")).not.toBeNull();
  });
  it("geçerli URL kabul eder", () => {
    expect(isUrl()("https://example.com")).toBeNull();
  });
  it("boş URL'i geçer (required işi)", () => {
    expect(isUrl()("")).toBeNull();
  });
});

describe("oneOf", () => {
  it("listedeki değeri kabul eder", () => {
    expect(oneOf(["a", "b", "c"] as const)("b")).toBeNull();
  });
  it("listede olmayanı reddeder", () => {
    expect(oneOf(["a", "b"] as const)("z" as "a" | "b")).not.toBeNull();
  });
});

describe("validate", () => {
  it("ilk başarısız kuralı döner", () => {
    const err = validate("", [required("Zorunlu"), minLength(3, "kısa")]);
    expect(err).toBe("Zorunlu");
  });

  it("tüm kurallar geçince null döner", () => {
    expect(validate("hello", [required(), minLength(3)])).toBeNull();
  });
});

describe("validateForm", () => {
  it("birden çok alanı doğrular", () => {
    const form = { name: "", age: "150" };
    const result = validateForm(form, {
      name: [required("İsim gerekli")],
      age: [maxNumber(120, "Geçersiz yaş")],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBe("İsim gerekli");
    expect(result.errors.age).toBe("Geçersiz yaş");
  });

  it("tüm alanlar geçerliyse valid döner", () => {
    const form = { name: "Ada", amount: "100" };
    const result = validateForm(form, {
      name: [required()],
      amount: [isNumber(), isPositive()],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });
});
