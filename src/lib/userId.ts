"use client";

/* ─── Anahtar Sabitleri ─────────────────────────────────────── */
const KEY_USER_ID = "fa_user_id";
const KEY_USER_NAME = "fa_user_name";
const KEY_LOGGED_IN = "fa_logged_in";
const KEY_IS_DEMO = "fa_is_demo";

/** Sabit demo kullanıcı ID'si — her zaman aynı seed veriyi alır */
const DEMO_USER_ID = "demo_user_finans";

/* ─── Session Yönetimi ─────────────────────────────────────── */

/** Kullanıcının oturum açıp açmadığını kontrol eder */
export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY_LOGGED_IN) === "true";
}

/** Aktif kullanıcının ID'sini döndürür */
export function getUserId(): string {
  if (typeof window === "undefined") return "anonymous";
  return localStorage.getItem(KEY_USER_ID) || "anonymous";
}

/** Aktif kullanıcının adını döndürür */
export function getUserName(): string {
  if (typeof window === "undefined") return "Misafir";
  return localStorage.getItem(KEY_USER_NAME) || "Misafir";
}

/** Demo hesap olup olmadığını kontrol eder */
export function isDemoAccount(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY_IS_DEMO) === "true";
}

/** Yeni kullanıcı oturumu oluşturur (kayıt/giriş) */
export function createSession(name: string): string {
  const id = "u_" + Math.random().toString(36).slice(2, 10);
  localStorage.setItem(KEY_USER_ID, id);
  localStorage.setItem(KEY_USER_NAME, name);
  localStorage.setItem(KEY_LOGGED_IN, "true");
  localStorage.setItem(KEY_IS_DEMO, "false");
  return id;
}

/** Demo hesap oturumu oluşturur */
export function createDemoSession(): string {
  localStorage.setItem(KEY_USER_ID, DEMO_USER_ID);
  localStorage.setItem(KEY_USER_NAME, "Demo Kullanıcı");
  localStorage.setItem(KEY_LOGGED_IN, "true");
  localStorage.setItem(KEY_IS_DEMO, "true");
  return DEMO_USER_ID;
}

/** Oturumu sonlandırır */
export function clearSession(): void {
  localStorage.removeItem(KEY_USER_ID);
  localStorage.removeItem(KEY_USER_NAME);
  localStorage.removeItem(KEY_LOGGED_IN);
  localStorage.removeItem(KEY_IS_DEMO);
}
