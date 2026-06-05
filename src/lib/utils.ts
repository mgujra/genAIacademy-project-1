import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function padCik(cik: string | number): string {
  return String(cik).replace(/\D/g, "").padStart(10, "0");
}

export function cikToUrl(cik: string | number): string {
  const padded = padCik(cik);
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${padded}&type=&dateb=&owner=include&count=40`;
}

export function filingUrl(
  cik: string | number,
  accessionNumber: string,
  primaryDocument?: string | null,
): string {
  const cikNum = String(cik).replace(/\D/g, "");
  const accession = accessionNumber.replace(/-/g, "");
  if (primaryDocument) {
    return `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accession}/${primaryDocument}`;
  }
  return `https://www.sec.gov/cgi-bin/viewer?action=view&cik=${padCik(cik)}&accession_number=${accessionNumber}&xbrl_type=v`;
}
