import { z } from "zod";

export const dateCuratorSchema = z.object({
  targetDate: z.string().nullable().describe("ISO date string for expected IPO date"),
  confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
  reasoning: z.string().describe("Explanation of how the date was determined"),
  citedSources: z.array(
    z.object({
      formType: z.string(),
      accessionNumber: z.string(),
      excerpt: z.string().optional(),
    }),
  ),
});

export const riskAssessmentSchema = z.object({
  overallRisk: z.enum(["low", "medium", "high"]),
  summary: z.string().describe("Plain-language investor summary"),
  topRisks: z.array(
    z.object({
      title: z.string(),
      category: z.enum([
        "financial",
        "legal",
        "market",
        "governance",
        "operational",
        "regulatory",
        "other",
      ]),
      severity: z.enum(["low", "medium", "high"]),
      description: z.string(),
      citation: z.string().optional(),
    }),
  ),
});

export type DateCuratorResult = z.infer<typeof dateCuratorSchema>;
export type RiskAssessmentResult = z.infer<typeof riskAssessmentSchema>;
