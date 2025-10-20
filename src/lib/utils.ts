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
