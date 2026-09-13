"use client";

import { dict, type DictKey, type Lang } from "@/lib/i18n/dict";

const KEY = "ds_lang";
const listeners = new Set<() => void>();

function readLang(): Lang {
  if (typeof window === "undefined") return "hi";
  const saved = localStorage.getItem(KEY) || "";
  if (saved === "en" || saved === "hi") return saved;
  const cookie = document.cookie.split(";").find((p) => p.trim().startsWith(`${KEY}=`));
  const value = cookie?.split("=")[1]?.trim();
  return value === "en" ? "en" : "hi";
}

let current: Lang = "hi";

export function getLang() {
  return current;
}

export function getLangSnapshot() {
  if (typeof window === "undefined") return "hi" as Lang;
  current = readLang();
  return current;
}

export function subscribeLang(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setLang(next: Lang) {
  current = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, next);
    document.cookie = `${KEY}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next === "hi" ? "hi" : "en";
  }
  listeners.forEach((fn) => fn());
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
  document.documentElement.lang = current === "hi" ? "hi" : "en";
}
