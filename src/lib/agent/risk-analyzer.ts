import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { extractRiskFactorsSection } from "@/lib/sec/parsers";
import { riskAssessmentSchema, type RiskAssessmentResult } from "./schemas";

export async function analyzeProspectusRisks(
  companyName: string,
  prospectusHtml: string,
  sourceAccession: string,
): Promise<{
  result: RiskAssessmentResult;
  rawExcerpt: string | null;
}> {
  const rawExcerpt = extractRiskFactorsSection(prospectusHtml);

  if (!rawExcerpt) {
    return {
      result: {
        overallRisk: "medium",
        summary: `Risk Factors section could not be extracted from the prospectus for ${companyName}. Manual review of SEC filing ${sourceAccession} is recommended.`,
        topRisks: [],
      },
      rawExcerpt: null,
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      result: fallbackRiskAnalysis(companyName, rawExcerpt),
      rawExcerpt,
    };
  }

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: riskAssessmentSchema,
    prompt: `You are an investment research analyst evaluating IPO risks for ${companyName}.

Analyze the following Risk Factors excerpt from SEC filing ${sourceAccession}.

Identify the top 5-10 most material risks for investors. Categorize each risk and assign severity.

Risk Factors excerpt:
${rawExcerpt.slice(0, 12000)}

Provide a concise overall summary suitable for retail investors. Be factual and cite specific risk themes from the text.`,
  });

  return { result: object, rawExcerpt };
}

function fallbackRiskAnalysis(
  companyName: string,
  excerpt: string,
): RiskAssessmentResult {
  const riskKeywords = [
    { keyword: "profit", category: "financial" as const },
    { keyword: "loss", category: "financial" as const },
    { keyword: "litigation", category: "legal" as const },
    { keyword: "regulat", category: "regulatory" as const },
    { keyword: "compet", category: "market" as const },
    { keyword: "debt", category: "financial" as const },
    { keyword: "management", category: "governance" as const },
  ];

  const sentences = excerpt.split(/(?<=[.!?])\s+/).slice(0, 200);
  const topRisks: RiskAssessmentResult["topRisks"] = [];

  for (const sentence of sentences) {
    if (topRisks.length >= 8) break;
    const lower = sentence.toLowerCase();
    const match = riskKeywords.find((k) => lower.includes(k.keyword));
    if (match && sentence.length > 40 && sentence.length < 500) {
      topRisks.push({
        title: sentence.slice(0, 80).trim() + (sentence.length > 80 ? "..." : ""),
        category: match.category,
        severity: lower.includes("material") || lower.includes("significant")
          ? "high"
          : "medium",
        description: sentence.trim(),
      });
    }
  }

  const highCount = topRisks.filter((r) => r.severity === "high").length;

  return {
    overallRisk: highCount >= 3 ? "high" : highCount >= 1 ? "medium" : "low",
    summary: `Automated keyword analysis of ${companyName} prospectus identified ${topRisks.length} notable risk themes. Configure OPENAI_API_KEY for full LLM analysis.`,
    topRisks,
  };
}
