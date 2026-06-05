import { unstable_cache } from "next/cache";
import { padCik } from "@/lib/utils";
import type { SecCompanySubmissions, SecFilingHit } from "./types";
import { IPO_FORM_TYPES } from "./types";

const SEC_BASE = "https://data.sec.gov";
const EFTS_BASE = "https://efts.sec.gov/LATEST/search-index";
const SEC_ARCHIVES = "https://www.sec.gov/Archives/edgar/data";

class RateLimiter {
  private queue: Array<() => void> = [];
  private lastRequest = 0;
  private readonly minIntervalMs: number;

  constructor(requestsPerSecond = 8) {
    this.minIntervalMs = 1000 / requestsPerSecond;
  }

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const now = Date.now();
          const wait = Math.max(0, this.minIntervalMs - (now - this.lastRequest));
          if (wait > 0) await new Promise((r) => setTimeout(r, wait));
          this.lastRequest = Date.now();
          resolve(await fn());
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.queue.length === 0) return;
    const task = this.queue.shift();
    if (task) await task();
    if (this.queue.length > 0) this.processQueue();
  }
}

const limiter = new RateLimiter(8);

function getUserAgent(): string {
  const ua = process.env.SEC_USER_AGENT;
  if (!ua) {
    throw new Error(
      'SEC_USER_AGENT is required. Format: "AppName you@email.com"',
    );
  }
  return ua;
}

async function secFetch(url: string, init?: RequestInit): Promise<Response> {
  return limiter.throttle(async () => {
    const response = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": getUserAgent(),
        Accept: "application/json",
        ...init?.headers,
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`SEC request failed: ${response.status} ${url}`);
    }

    return response;
  });
}

async function secFetchText(url: string): Promise<string> {
  return limiter.throttle(async () => {
    const response = await fetch(url, {
      headers: {
        "User-Agent": getUserAgent(),
        Accept: "text/html,application/xhtml+xml",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`SEC document fetch failed: ${response.status} ${url}`);
    }

    return response.text();
  });
}

export async function searchIpoFilings(
  startDate: string,
  endDate: string,
  from = 0,
  size = 100,
): Promise<{ hits: SecFilingHit[]; total: number }> {
  const forms = IPO_FORM_TYPES.join(",");
  const params = new URLSearchParams({
    q: '"',
    forms,
    dateRange: "custom",
    startdt: startDate,
    enddt: endDate,
    from: String(from),
    size: String(size),
  });

  const data = await secFetch(`${EFTS_BASE}?${params}`).then((r) => r.json());

  const hits: SecFilingHit[] = (data.hits?.hits ?? []).map(
    (hit: {
      _source: {
        ciks?: string[];
        display_names?: string[];
        form?: string;
        file_date?: string;
        adsh?: string;
        root_forms?: string[];
      };
    }) => {
      const source = hit._source;
      const cik = source.ciks?.[0] ?? "";
      const accession = source.adsh ?? "";

      return {
        cik: padCik(cik),
        companyName: source.display_names?.[0] ?? "Unknown",
        formType: source.form ?? source.root_forms?.[0] ?? "",
        filedAt: source.file_date ?? "",
        accessionNumber: accession,
        primaryDocument: undefined,
        description: source.form,
      } satisfies SecFilingHit;
    },
  );

  return {
    hits: hits.filter((h) => h.cik && h.accessionNumber),
    total: data.hits?.total?.value ?? hits.length,
  };
}

export async function getAllIpoFilingsInRange(
  startDate: string,
  endDate: string,
): Promise<SecFilingHit[]> {
  const all: SecFilingHit[] = [];
  let from = 0;
  const size = 100;

  while (true) {
    const { hits, total } = await searchIpoFilings(
      startDate,
      endDate,
      from,
      size,
    );
    all.push(...hits);
    from += size;
    if (from >= total || hits.length === 0) break;
  }

  return all;
}

export async function getCompanySubmissions(
  cik: string,
): Promise<SecCompanySubmissions> {
  const padded = padCik(cik);
  const url = `${SEC_BASE}/submissions/CIK${padded}.json`;
  const data = await secFetch(url).then((r) => r.json());

  const recent = data.filings?.recent;
  const filings: SecFilingHit[] = [];

  if (recent) {
    for (let i = 0; i < (recent.accessionNumber?.length ?? 0); i++) {
      const formType = recent.form[i] as string;
      if (!IPO_FORM_TYPES.includes(formType as (typeof IPO_FORM_TYPES)[number])) {
        continue;
      }

      filings.push({
        cik: padded,
        companyName: data.name,
        formType,
        filedAt: recent.filingDate[i],
        accessionNumber: recent.accessionNumber[i],
        primaryDocument: recent.primaryDocument?.[i],
        description: recent.primaryDocument?.[i],
      });
    }
  }

  return {
    cik: padded,
    name: data.name,
    tickers: data.tickers ?? [],
    exchanges: data.exchanges ?? [],
    sic: data.sic,
    filings,
  };
}

export function getFilingDocumentUrl(
  cik: string,
  accessionNumber: string,
  primaryDocument: string,
): string {
  const cikNum = String(cik).replace(/\D/g, "");
  const accession = accessionNumber.replace(/-/g, "");
  return `${SEC_ARCHIVES}/${cikNum}/${accession}/${primaryDocument}`;
}

export async function fetchFilingDocument(
  cik: string,
  accessionNumber: string,
  primaryDocument: string,
): Promise<string> {
  const url = getFilingDocumentUrl(cik, accessionNumber, primaryDocument);
  return secFetchText(url);
}

export async function fetchFilingByAccession(
  cik: string,
  accessionNumber: string,
): Promise<string | null> {
  const submissions = await getCompanySubmissions(cik);
  const filing = submissions.filings.find(
    (f) => f.accessionNumber === accessionNumber,
  );

  if (!filing?.primaryDocument) {
    const indexUrl = `${SEC_ARCHIVES}/${String(cik).replace(/\D/g, "")}/${accessionNumber.replace(/-/g, "")}/index.json`;
    try {
      const index = await secFetch(indexUrl).then((r) => r.json());
      const primary =
        index.directory?.item?.find(
          (item: { type?: string; name?: string }) =>
            item.type === "S-1" ||
            item.type === "424B4" ||
            item.name?.endsWith(".htm"),
        )?.name ?? index.directory?.item?.[0]?.name;

      if (primary) {
        return fetchFilingDocument(cik, accessionNumber, primary);
      }
    } catch {
      return null;
    }
    return null;
  }

  return fetchFilingDocument(cik, accessionNumber, filing.primaryDocument);
}

export const cachedSearchIpoFilings = unstable_cache(
  searchIpoFilings,
  ["sec-ipo-search"],
  { revalidate: 3600 },
);
