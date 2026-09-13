"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_LANG, type DictKey } from "@/lib/i18n/dict";
import { getLangSnapshot, setLang, subscribeLang, translate } from "@/lib/i18n/store";

export function useI18n() {
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, () => DEFAULT_LANG);
  const t = useCallback((key: DictKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  return { lang, setLang, t };
}
