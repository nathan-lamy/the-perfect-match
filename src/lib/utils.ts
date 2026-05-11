import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { historicalCounts, Student } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Students parsing
function isUpperCase(word: string): boolean {
  return word === word.toUpperCase() && word !== word.toLowerCase();
}

function parseStudent(fullName: string): Student {
  const parts = fullName.trim().split(/\s+/);

  const lastNameParts: string[] = [];
  const firstNameParts: string[] = [];

  for (const part of parts) {
    if (isUpperCase(part)) {
      lastNameParts.push(part);
    } else {
      firstNameParts.push(part);
    }
  }

  return {
    name: fullName.trim(),
    first_name: firstNameParts.join(" "),
    last_name: lastNameParts.join(" "),
  };
}

export function parseStudents(historicalCounts: historicalCounts[]): Student[] {
  const names = Object.keys(
    historicalCounts.find((c) => c.id === 1)?.counts ?? {},
  );
  return names.map(parseStudent);
}

export function sortStudentsByName(students: Student[]): Student[] {
  return students.sort((a, b) => {
    // 1. Sort by last_name
    if (a.last_name < b.last_name) return -1;
    if (a.last_name > b.last_name) return 1;

    // 2. If last_names are equal, sort by first_name
    if (a.first_name < b.first_name) return -1;
    if (a.first_name > b.first_name) return 1;

    return 0;
  });
}

// Date utils
export function parseISODate(s: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Return YYYYMMDD
export function formatDate(ds: string): string {
  const d = parseISODate(ds)!;
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
