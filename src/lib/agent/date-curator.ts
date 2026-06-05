import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { extractDateSignals } from "@/lib/sec/parsers";
import type { DateSignal } from "@/lib/sec/types";
import { dateCuratorSchema, type DateCuratorResult } from "./schemas";

interface FilingContext {
  formType: string;
  accessionNumber: string;
  filedAt: string;
  documentText?: string;
}

export async function curateIpoDate(
  companyName: string,
  filings: FilingContext[],
): Promise<{
  result: DateCuratorResult;
  signals: DateSignal[];
}> {
  const allSignals: DateSignal[] = [];

  for (const filing of filings) {
    if (!filing.documentText) continue;
    const signals = extractDateSignals(
      filing.documentText,
      `${filing.formType} (${filing.accessionNumber})`,
    );
    allSignals.push(...signals);
  }

  const effectFiling = filings.find((f) => f.formType === "EFFECT");
  const prospectus424 = filings.find((f) => f.formType === "424B4");

  if (!process.env.OPENAI_API_KEY) {
    return {
      result: fallbackDateCuration(allSignals, effectFiling, prospectus424),
      signals: allSignals,
    };
  }

  const filingSummary = filings
    .map(
      (f) =>
        `- ${f.formType} filed ${f.filedAt} (${f.accessionNumber})${f.documentText ? `: ${f.documentText.slice(0, 500)}...` : ""}`,
    )
    .join("\n");

  const signalSummary = allSignals
    .map((s) => `- [${s.type}] ${s.date ?? "unknown"} from ${s.source}: ${s.excerpt ?? ""}`)
    .join("\n");

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: dateCuratorSchema,
    prompt: `You are an IPO date curator analyzing SEC filings for ${companyName}.

Based on the filing history and extracted date signals, determine the most likely target IPO/listing date.

Filing history:
${filingSummary}

Extracted date signals:
${signalSummary || "No explicit date signals found."}

Rules:
- EFFECT filing means registration is effective; IPO typically follows within days.
- 424B4 means the IPO has been priced; use that filing date as high-confidence target.
- S-1/A amendments may update expected timing.
- Provide confidence 0.0-1.0 based on signal strength.
- Cite specific filings in citedSources.
- If no reliable date, return null targetDate with low confidence and explain why.`,
  });

  return { result: object, signals: allSignals };
}

function fallbackDateCuration(
  signals: DateSignal[],
  effectFiling?: FilingContext,
  prospectus424?: FilingContext,
): DateCuratorResult {
  if (prospectus424) {
    return {
      targetDate: prospectus424.filedAt,
      confidence: 0.9,
      reasoning:
        "424B4 final prospectus filed, indicating IPO has been priced. Using filing date as target.",
      citedSources: [
        {
          formType: "424B4",
          accessionNumber: prospectus424.accessionNumber,
        },
      ],
    };
  }

  if (effectFiling) {
    const effectDate = new Date(effectFiling.filedAt);
    effectDate.setDate(effectDate.getDate() + 3);
    return {
      targetDate: effectDate.toISOString(),
      confidence: 0.7,
      reasoning:
        "EFFECT notice filed. IPO typically occurs within a few days after effectiveness.",
      citedSources: [
        {
          formType: "EFFECT",
          accessionNumber: effectFiling.accessionNumber,
        },
      ],
    };
  }

  const bestSignal = signals.sort((a, b) => {
    const priority: Record<string, number> = {
      listing_date: 4,
      expected_offering: 3,
      roadshow: 2,
      effective_date: 1,
    };
    return (priority[b.type] ?? 0) - (priority[a.type] ?? 0);
  })[0];

  if (bestSignal?.date) {
    return {
      targetDate: bestSignal.date,
      confidence: 0.5,
      reasoning: `Derived from ${bestSignal.type} signal in ${bestSignal.source}.`,
      citedSources: [{ formType: bestSignal.type, accessionNumber: bestSignal.source }],
    };
  }

  return {
    targetDate: null,
    confidence: 0.2,
    reasoning:
      "Insufficient date signals in available filings. Monitor for EFFECT or 424B4 filings.",
    citedSources: [],
  };
}
