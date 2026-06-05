import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { ipoCompanies } from "@/db/schema";
import { padCik } from "@/lib/utils";

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return new Response("Database not configured", { status: 503 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return new Response("OPENAI_API_KEY not configured", { status: 503 });
  }

  const { messages, cik } = await request.json();

  const db = getDb();
  const company = await db.query.ipoCompanies.findFirst({
    where: eq(ipoCompanies.cik, padCik(cik)),
    with: {
      riskAssessments: { limit: 1 },
      dateEstimates: { limit: 1 },
      filings: { limit: 10 },
    },
  });

  if (!company) {
    return new Response("IPO not found", { status: 404 });
  }

  const context = {
    name: company.name,
    status: company.status,
    riskAssessment: company.riskAssessments[0],
    dateEstimate: company.dateEstimates[0],
    filings: company.filings.map((f) => ({
      form: f.formType,
      date: f.filedAt,
      accession: f.accessionNumber,
    })),
  };

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: `You are an IPO research assistant for ${company.name}. Answer questions based only on the provided SEC filing context. Be factual, cite filing types when relevant, and include disclaimers that this is not investment advice.

Context:
${JSON.stringify(context, null, 2)}`,
    messages,
  });

  return result.toTextStreamResponse();
}
