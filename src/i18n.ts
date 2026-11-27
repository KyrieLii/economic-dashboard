import { useSyncExternalStore } from "react";
import english from "./locales/en.json";
export type Locale = "zh-CN" | "en";
const dictionary: Record<string, string> = english;
const languageKey = "economic:language";
let current: Locale = "zh-CN";
try {
  if (
    typeof localStorage !== "undefined" &&
    localStorage.getItem(languageKey) === "en"
  )
    current = "en";
} catch {
  /* Keep Chinese when browser storage is unavailable. */
}
const listeners = new Set<() => void>();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = Object.entries(dictionary)
  .filter(([key]) => /\{\d+\}/.test(key))
  .map(([key, value]) => {
    const indices = [...key.matchAll(/\{(\d+)\}/g)].map((match) =>
      Number(match[1]),
    );
    return {
      regex: new RegExp(
        "^" +
          key
            .split(/\{\d+\}/)
            .map(escape)
            .join("([\\s\\S]*?)") +
          "$",
      ),
      indices,
      value,
    };
  });
export function translate(
  text: string,
  locale: Locale,
  ...values: unknown[]
): string {
  let template =
    locale === "en" ? (dictionary[text] ?? dictionary[text.trim()]) : text;
  if (template === undefined && locale === "en") {
    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (!match) continue;
      template = pattern.value;
      values = [];
      pattern.indices.forEach((index, i) => {
        values[index] = match[i + 1];
      });
      break;
    }
  }
  return (template ?? text).replace(/\{(\d+)\}/g, (match, index) =>
    values[index] === undefined
      ? match
      : translate(String(values[index]), locale),
  );
}
export const t = (text: string, ...values: unknown[]) =>
  translate(text, current, ...values);
export const getLocale = () => (current === "en" ? "en-US" : "zh-CN");
export function setLocale(locale: Locale) {
  current = locale;
  try {
    localStorage.setItem(languageKey, locale);
  } catch {
    /* Switching still works for this session. */
  }
  listeners.forEach((listener) => listener());
}
export function useLocale() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => current,
  );
}
