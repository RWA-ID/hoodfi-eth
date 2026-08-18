import { formatEther } from "viem";

export function formatEth(wei: bigint, digits = 5): string {
  const s = Number(formatEther(wei));
  if (s === 0) return "0";
  if (s < 0.00001) return "<0.00001";
  return s.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function expiryYear(timestamp: bigint | undefined): number | undefined {
  if (!timestamp || timestamp === 0n) return undefined;
  return new Date(Number(timestamp) * 1000).getUTCFullYear();
}

export function expiryDate(timestamp: bigint | undefined): string {
  if (!timestamp || timestamp === 0n) return "—";
  return new Date(Number(timestamp) * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
