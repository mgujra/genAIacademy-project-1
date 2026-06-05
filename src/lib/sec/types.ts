export const IPO_FORM_TYPES = [
  "S-1",
  "S-1/A",
  "F-1",
  "F-1/A",
  "424B4",
  "424B1",
  "424B3",
  "EFFECT",
  "8-K",
] as const;

export type IpoFormType = (typeof IPO_FORM_TYPES)[number];

export interface SecFilingHit {
  cik: string;
  companyName: string;
  formType: string;
  filedAt: string;
  accessionNumber: string;
  primaryDocument?: string;
  description?: string;
}

export interface SecCompanySubmissions {
  cik: string;
  name: string;
  tickers: string[];
  exchanges: string[];
  sic?: string;
  filings: SecFilingHit[];
}

export interface DateSignal {
  type: string;
  date?: string;
  source: string;
  excerpt?: string;
}
