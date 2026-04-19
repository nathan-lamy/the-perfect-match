import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Session storage utilities
const SESSION_KEY = "bjcolle_session";

export function saveSession(session: string): void {
  localStorage.setItem(SESSION_KEY, session);
}

export function loadSession(): string {
  return localStorage.getItem(SESSION_KEY) || '';
}
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
// Cache storage utilities
export const CACHE_KEY = "bjcolle_cache_";
export function saveCache(key: string, data: any) {
  localStorage.setItem(CACHE_KEY + key, JSON.stringify(data));
}
export function loadCache<T>(key: string): T | null {
  const item = localStorage.getItem(CACHE_KEY + key);
  return item ? (JSON.parse(item) as T) : null;
}
export function clearCache(key: string) {
  localStorage.removeItem(CACHE_KEY + key);
}

// Time utilities
export function compareTimes(t1: string, t2: string) {
  const [h1, m1] = t1.split(":").map(Number);
  const [h2, m2] = t2.split(":").map(Number);

  const minutes1 = h1 * 60 + m1;
  const minutes2 = h2 * 60 + m2;

  return minutes1 - minutes2;
}

// Timezone-safe: parse as local midnight, NOT UTC
export function getDayOfWeek(dateStr: string): string {
  // Parse YYYY-MM-DD or YYYY/MM/DD as local date
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }
  // Fallback
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Returns YYYY/MM/DD one week before input (handles both YYYY-MM-DD and YYYY/MM/DD)
export function getWeekBefore(dateStr: string): string {
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    date.setDate(date.getDate() - 7);
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, "0");
    const newDay = String(date.getDate()).padStart(2, "0");
    return `${newYear}/${newMonth}/${newDay}`;
  }
  // Fallback
  const date = new Date(dateStr);
  date.setDate(date.getDate() - 7);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}
