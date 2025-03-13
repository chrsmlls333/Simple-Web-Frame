import { twMerge } from "tailwind-merge";
import clsx, { type ClassValue } from "clsx";

export const cn = (...classes: ClassValue[]) => twMerge(clsx(classes));

// =====================================================================================

export function getReadableUUID(uuid: string): string {
  // everything before the first hyphen
  return uuid.split("-")[0].toLocaleUpperCase().slice(0, 6);
};

export function formatTimestamp(timestamp?: number): string {
  if (!timestamp) return "Never";
  return new Date(timestamp).toLocaleString();
}