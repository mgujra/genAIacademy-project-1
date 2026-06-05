import type { DateSignal } from "./types";

const HTML_TAG_REGEX = /<[^>]+>/g;
const WHITESPACE_REGEX = /\s+/g;

export function stripHtml(html: string): string {
  return html
    .replace(HTML_TAG_REGEX, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(WHITESPACE_REGEX, " ")
    .trim();
}

export function extractRiskFactorsSection(html: string): string | null {
  const text = stripHtml(html);
  const patterns = [
    /risk factors\s*(.*?)(?:use of proceeds|market (?:and )?industry|management(?:'s)? discussion|financial statements|legal proceedings)/is,
    /item\s*1a\.?\s*risk factors\s*(.*?)(?:item\s*1b|item\s*2\.|unregistered sales)/is,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1] && match[1].length > 500) {
      return match[1].slice(0, 15000);
    }
  }

  const riskIndex = text.toLowerCase().indexOf("risk factors");
  if (riskIndex >= 0) {
    return text.slice(riskIndex, riskIndex + 15000);
  }

  return null;
}

export function extractOfferPrice(html: string): number | null {
  const text = stripHtml(html);
  const patterns = [
    /public offering price\s*(?:of\s*)?\$?\s*([\d,.]+)\s*per share/i,
    /initial public offering price\s*(?:of\s*)?\$?\s*([\d,.]+)/i,
    /offering price\s*(?:of\s*)?\$?\s*([\d,.]+)\s*per share/i,
    /price to public\s*\$?\s*([\d,.]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const price = parseFloat(match[1].replace(/,/g, ""));
      if (!Number.isNaN(price) && price > 0 && price < 10000) return price;
    }
  }

  return null;
}

export function extractPriceRange(html: string): { low: number; high: number } | null {
  const text = stripHtml(html);
  const match = text.match(
    /\$?\s*([\d,.]+)\s*(?:to|–|-)\s*\$?\s*([\d,.]+)\s*per share/i,
  );

  if (match) {
    const low = parseFloat(match[1].replace(/,/g, ""));
    const high = parseFloat(match[2].replace(/,/g, ""));
    if (!Number.isNaN(low) && !Number.isNaN(high)) return { low, high };
  }

  return null;
}

export function extractDateSignals(
  html: string,
  source: string,
): DateSignal[] {
  const text = stripHtml(html);
  const signals: DateSignal[] = [];

  const datePatterns: Array<{ type: string; regex: RegExp }> = [
    {
      type: "expected_offering",
      regex:
        /(?:expect(?:s|ed)? to|anticipat(?:e|es|ed)|plan(?:s|ned)? to)\s+(?:complete|price|conduct|begin)\s+(?:this\s+)?(?:offering|ipo)[^.]{0,120}?(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{4})/gi,
    },
    {
      type: "roadshow",
      regex:
        /road\s*show[^.]{0,200}?(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+\w+\s+\d{4})/gi,
    },
    {
      type: "effective_date",
      regex:
        /(?:effective|effectiveness)\s+(?:date|on)[^.]{0,80}?(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+\w+\s+\d{4})/gi,
    },
    {
      type: "listing_date",
      regex:
        /(?:list(?:ing)?|trad(?:e|ing))\s+(?:on|commence)[^.]{0,120}?(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+\w+\s+\d{4})/gi,
    },
  ];

  for (const { type, regex } of datePatterns) {
    let match: RegExpExecArray | null;
    const re = new RegExp(regex.source, regex.flags);
    while ((match = re.exec(text)) !== null) {
      const excerpt = match[0].slice(0, 200);
      const dateStr = match[1];
      const parsed = tryParseDate(dateStr);
      if (parsed) {
        signals.push({
          type,
          date: parsed.toISOString(),
          source,
          excerpt,
        });
      }
    }
  }

  return signals;
}

function tryParseDate(dateStr: string): Date | null {
  const parsed = new Date(dateStr);
  if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() > 2020) {
    return parsed;
  }
  return null;
}

export function inferCompanyStatus(
  formTypes: string[],
  hasTicker: boolean,
): "upcoming" | "priced" | "listed" | "withdrawn" {
  if (formTypes.some((f) => f === "424B4")) {
    return hasTicker ? "listed" : "priced";
  }
  if (formTypes.some((f) => f === "EFFECT")) {
    return "upcoming";
  }
  if (formTypes.some((f) => f.startsWith("S-1") || f.startsWith("F-1"))) {
    return "upcoming";
  }
  return "upcoming";
}
