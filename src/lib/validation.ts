/**
 * Hafif form validasyon yardımcısı.
 *
 * Tasarım hedefi:
 *  - Sıfır bağımlılık (zod yok), küçük bundle
 *  - Tip-güvenli kural setleri
 *  - Compose edilebilir: `validate(value, [required(), minNumber(0)])`
 *
 * Kullanım:
 *   const err = validate("", [required("İsim gerekli")]);
 *   // err === "İsim gerekli"
 */

export type ValidationRule<T = unknown> = (value: T) => string | null;
export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/* ─── Tek-değer validatörü ─────────────────────────────────── */
export function validate<T>(value: T, rules: ValidationRule<T>[]): string | null {
  for (const rule of rules) {
    const err = rule(value);
    if (err) return err;
  }
  return null;
}

/* ─── Form validatörü ──────────────────────────────────────── */
export function validateForm<T extends Record<string, unknown>>(
  form: T,
  schema: { [K in keyof T]?: ValidationRule<T[K]>[] },
): { valid: boolean; errors: FieldErrors<T> } {
  const errors: FieldErrors<T> = {};
  let valid = true;
  for (const key of Object.keys(schema) as (keyof T)[]) {
    const rules = schema[key];
    if (!rules) continue;
    const err = validate(form[key], rules);
    if (err) {
      errors[key] = err;
      valid = false;
    }
  }
  return { valid, errors };
}

/* ─── Kurallar ─────────────────────────────────────────────── */

export const required =
  (message = "Bu alan zorunlu"): ValidationRule<unknown> =>
  (v) => {
    if (v === null || v === undefined) return message;
    if (typeof v === "string" && v.trim() === "") return message;
    if (Array.isArray(v) && v.length === 0) return message;
    return null;
  };

export const minLength =
  (min: number, message?: string): ValidationRule<string> =>
  (v) =>
    (v ?? "").length < min
      ? (message ?? `En az ${min} karakter olmalı`)
      : null;

export const maxLength =
  (max: number, message?: string): ValidationRule<string> =>
  (v) =>
    (v ?? "").length > max
      ? (message ?? `En fazla ${max} karakter olabilir`)
      : null;

export const minNumber =
  (min: number, message?: string): ValidationRule<number | string> =>
  (v) => {
    const n = typeof v === "string" ? Number(v) : v;
    if (Number.isNaN(n)) return "Geçerli bir sayı girin";
    return n < min ? (message ?? `En az ${min} olmalı`) : null;
  };

export const maxNumber =
  (max: number, message?: string): ValidationRule<number | string> =>
  (v) => {
    const n = typeof v === "string" ? Number(v) : v;
    if (Number.isNaN(n)) return "Geçerli bir sayı girin";
    return n > max ? (message ?? `En fazla ${max} olabilir`) : null;
  };

export const isNumber =
  (message = "Geçerli bir sayı girin"): ValidationRule<unknown> =>
  (v) => {
    if (v === "" || v === null || v === undefined) return null; // required ile birleşir
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isNaN(n) ? message : null;
  };

export const isPositive =
  (message = "Pozitif bir sayı girin"): ValidationRule<number | string> =>
  (v) => {
    const n = typeof v === "string" ? Number(v) : v;
    if (Number.isNaN(n)) return null;
    return n <= 0 ? message : null;
  };

export const isUrl =
  (message = "Geçerli bir URL girin"): ValidationRule<string> =>
  (v) => {
    if (!v) return null;
    try {
      new URL(v);
      return null;
    } catch {
      return message;
    }
  };

export const oneOf =
  <V extends string | number>(
    values: readonly V[],
    message?: string,
  ): ValidationRule<V> =>
  (v) =>
    values.includes(v)
      ? null
      : (message ??
        `Geçerli değerler: ${values.join(", ")}`);

export const matches =
  (re: RegExp, message: string): ValidationRule<string> =>
  (v) =>
    re.test(v ?? "") ? null : message;
