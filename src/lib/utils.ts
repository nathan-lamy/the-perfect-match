import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Session storage utilities
const SESSION_KEY = "bjcolle_session";

export function saveSession(session: string) {
  localStorage.setItem(SESSION_KEY, session);
}
export function loadSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
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
  const [h1, m1] = t1.split(':').map(Number);
  const [h2, m2] = t2.split(':').map(Number);

  const minutes1 = h1 * 60 + m1;
  const minutes2 = h2 * 60 + m2;

  return minutes1 - minutes2;
}

export function getDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}
