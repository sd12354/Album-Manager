import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "listed":
      return "Listed on eBay";
    case "sold":
      return "Sold";
    case "pricing":
      return "Pricing in progress";
    case "unlisted":
    default:
      return "Added to catalogue";
  }
}

export function getActivityDescription(
  status: string,
  soldPrice?: number | null
): string {
  switch (status) {
    case "sold":
      return soldPrice ? `sold for ${formatCurrency(soldPrice)}` : "marked as sold";
    case "listed":
      return "listed on eBay";
    case "pricing":
      return "pricing updated";
    case "unlisted":
    default:
      return "added to catalogue";
  }
}
