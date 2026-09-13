"use client";

import { DEFAULT_LANG, LANG_KEY, dict, type DictKey, type Lang } from "@/lib/i18n/dict";

const listeners = new Set<() => void>();

function parseLang(value: string | null | undefined): Lang | null {
  return value === "en" || value === "hi" ? value : null;
}

function readLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  const saved = parseLang(localStorage.getItem(LANG_KEY));
  if (saved) return saved;
  const cookie = document.cookie.split(";").find((p) => p.trim().startsWith(`${LANG_KEY}=`));
  return parseLang(cookie?.split("=")[1]?.trim()) ?? DEFAULT_LANG;
}

let current: Lang = DEFAULT_LANG;

export function getLang() {
  return current;
}

export function getLangSnapshot() {
  if (typeof window === "undefined") return DEFAULT_LANG;
  current = readLang();
  return current;
}

export function subscribeLang(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setLang(next: Lang) {
  if (next === readLang()) return;
  current = next;
  if (typeof window === "undefined") return;
  localStorage.setItem(LANG_KEY, next);
  document.cookie = `${LANG_KEY}=${next}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = next;
  window.location.reload();
}

export function translate(lang: Lang, key: DictKey, vars?: Record<string, string | number>) {
  let text: string = dict[lang][key] || dict.en[key] || key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

if (typeof window !== "undefined") {
  current = readLang();
  document.documentElement.lang = current;
  window.addEventListener("storage", (event) => {
    if (event.key !== LANG_KEY) return;
    window.location.reload();
  });
}
