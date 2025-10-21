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
