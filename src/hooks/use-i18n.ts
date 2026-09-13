"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { DictKey, Lang } from "@/lib/i18n/dict";
import { getLangSnapshot, setLang, subscribeLang, translate } from "@/lib/i18n/store";

export function useI18n() {
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, () => "hi" as Lang);
  const t = useCallback((key: DictKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  return { lang, setLang, t };
}
