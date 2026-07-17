/**
 * Single structured Gemini call: analyze the original résumé against the JD, rewrite it
 * ATS-optimized, and return the full before/after analysis as validated JSON.
 */
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { analysisSchema, type Analysis } from "../types/analysis.js";
import { HttpError } from "../lib/http.js";

// Use a stable "-latest" alias: pinned versions (gemini-2.0-flash, gemini-2.5-flash)
// get retired for newly-created API keys ("no longer available to new users").
const MODEL = "gemini-flash-lite-latest";

// Gemini's own response schema (guides the model toward valid JSON).
const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    atsScoreBefore: { type: SchemaType.NUMBER },
    atsScoreAfter: { type: SchemaType.NUMBER },
    scoreBreakdown: {
      type: SchemaType.OBJECT,
      properties: {
        keywordMatch: beforeAfter(),
        relevanceToJD: beforeAfter(),
        formatting: beforeAfter(),
        impactMetrics: beforeAfter(),
      },
      required: ["keywordMatch", "relevanceToJD", "formatting", "impactMetrics"],
    },
    keywordAnalysis: {
      type: SchemaType.OBJECT,
      properties: {
        jdKeywords: strArray(),
        matchedBefore: strArray(),
        missingBefore: strArray(),
        addedInNew: strArray(),
      },
      required: ["jdKeywords", "matchedBefore", "missingBefore", "addedInNew"],
    },
    improvements: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          area: { type: SchemaType.STRING },
          before: { type: SchemaType.STRING },
          after: { type: SchemaType.STRING },
          reason: { type: SchemaType.STRING },
        },
        required: ["area", "before", "after", "reason"],
      },
    },
    summaryOfChanges: { type: SchemaType.STRING },
    rewrittenCV: {
      type: SchemaType.OBJECT,
      properties: {
        fullName: { type: SchemaType.STRING },
        title: { type: SchemaType.STRING },
        contact: {
          type: SchemaType.OBJECT,
          properties: {
            email: { type: SchemaType.STRING },
            phone: { type: SchemaType.STRING },
            location: { type: SchemaType.STRING },
            links: strArray(),
          },
        },
        summary: { type: SchemaType.STRING },
        skills: strArray(),
        experience: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              role: { type: SchemaType.STRING },
              company: { type: SchemaType.STRING },
              dates: { type: SchemaType.STRING },
              bullets: strArray(),
            },
            required: ["role", "company", "dates", "bullets"],
          },
        },
        education: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              degree: { type: SchemaType.STRING },
              institution: { type: SchemaType.STRING },
              dates: { type: SchemaType.STRING },
            },
            required: ["degree", "institution", "dates"],
          },
        },
        projects: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              name: { type: SchemaType.STRING },
              description: { type: SchemaType.STRING },
              bullets: strArray(),
            },
            required: ["name", "description"],
          },
        },
        certifications: strArray(),
      },
      required: [
        "fullName",
        "title",
        "contact",
        "summary",
        "skills",
        "experience",
        "education",
      ],
    },
  },
  required: [
    "atsScoreBefore",
    "atsScoreAfter",
    "scoreBreakdown",
    "keywordAnalysis",
    "improvements",
    "summaryOfChanges",
    "rewrittenCV",
  ],
};

function beforeAfter() {
  return {
    type: SchemaType.OBJECT,
    properties: {
      before: { type: SchemaType.NUMBER },
      after: { type: SchemaType.NUMBER },
    },
    required: ["before", "after"],
  };
}

function strArray() {
  return { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } };
}

const SYSTEM_PROMPT = `You are an expert technical recruiter and certified résumé writer who
specializes in Applicant Tracking System (ATS) optimization.

You will be given a candidate's ORIGINAL résumé text and a target JOB DESCRIPTION (JD).

Do all of the following:
1. Score the ORIGINAL résumé for ATS fit against the JD (0-100) overall and per dimension
   (keywordMatch, relevanceToJD, formatting, impactMetrics).
2. Rewrite the résumé so it is ATS-compliant and tailored to the JD, then score the REWRITTEN
   version on the same dimensions (the "after" numbers, which should be realistically higher).
3. Extract the JD's important keywords/skills. List which were already matched in the original
   (matchedBefore), which were missing (missingBefore = what was lacking), and which you added to
   the rewrite (addedInNew = what it now has).
4. Provide an "improvements" list explaining, item by item, what changed and WHY it improved the
   score — especially why keyword matching improved.

HARD RULES — CONTENT INTEGRITY (these are non-negotiable; violating them harms the candidate):
- NEVER fabricate employers, job titles, dates, degrees, or credentials the candidate does not have.
- NEVER add a skill, tool, technology, platform, framework, or certification that does not already
  appear in the ORIGINAL résumé — not even if the JD clearly asks for it. If the JD requires
  something the candidate lacks, LEAVE IT OUT; it will be surfaced to them as a gap to fill in
  themselves. Do not write summaries claiming expertise in tools the résumé never mentions.
- NEVER invent numbers, percentages, or metrics. You may keep and rephrase a quantified result only
  if that exact number already appears in the original. Do NOT turn "fixed bugs" into "fixed 15+ bugs,
  reducing downtime by 10%" — inventing statistics the candidate can't defend in an interview is
  strictly forbidden.
- PRESERVE the candidate's real substantive content. Do not silently drop education details (GPA,
  coursework, honors), volunteer roles, projects, or certifications that were in the original. You may
  reorder or tighten wording, but keep the information.

HARD RULES — FORMAT:
- Only introduce a JD keyword where it is genuinely supported by the candidate's real experience.
- Use strong action verbs; you may re-frame real achievements, but never manufacture impact.
- Produce a single-column, ATS-safe structure (no tables/columns/graphics in the content).
- Be realistic with scores; do not output 100 unless truly warranted.
- Respond with ONLY the JSON object matching the provided schema.`;

export async function analyzeAndRewrite(params: {
  resumeText: string;
  jobDescription: string;
  atsSystems?: string[];
}): Promise<Analysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpError(500, "GEMINI_API_KEY is not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema as never,
      temperature: 0.4,
    },
  });

  const atsLine =
    params.atsSystems && params.atsSystems.length
      ? `\n\nTARGET ATS SYSTEMS: ${params.atsSystems.join(", ")}. Make the rewrite reliably ` +
        `parseable by these applicant tracking systems — standard section headings, single ` +
        `column, plain text, no tables/columns/graphics. Do NOT fabricate anything to fit them.`
      : "";
  // General-scan mode: no JD supplied — evaluate against the market-standard
  // profile for the candidate's own role instead of a specific job posting.
  const jdBlock = params.jobDescription.trim()
    ? `JOB DESCRIPTION:\n"""\n${params.jobDescription}\n"""`
    : `NO JOB DESCRIPTION PROVIDED — GENERAL SCAN. Infer the candidate's current/target role ` +
      `from the résumé itself. Then act as if the "JD" were the market-standard job profile ` +
      `for that role: the skills, keywords, and expectations employers typically list for it. ` +
      `Use those market-standard keywords everywhere the schema refers to JD keywords. All ` +
      `HARD RULES still apply — never fabricate skills or metrics to fit the standard profile.`;
  const userPrompt = `ORIGINAL RÉSUMÉ:\n"""\n${params.resumeText}\n"""\n\n${jdBlock}${atsLine}`;

  // Up to 3 attempts: retries transient overload (503) and parse/validation failures.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent(userPrompt);
      const raw = result.response.text();
      const parsed = JSON.parse(raw);
      return analysisSchema.parse(parsed);
    } catch (err) {
      lastErr = err;
      if (isRateLimit(err)) {
        // Quota exhausted (limit: 0 for retired models, or free-tier cap reached).
        throw new HttpError(
          429,
          `The AI model quota is unavailable. ${cleanMessage(err)}`.trim(),
        );
      }
      if (isOverloaded(err) && attempt < 2) {
        continue; // transient — retry
      }
    }
  }
  throw new HttpError(
    502,
    `The AI returned an unexpected response. ${cleanMessage(lastErr)}`.trim(),
  );
}

function messageOf(err: unknown): string {
  return (err as Error)?.message?.toLowerCase() ?? "";
}

function cleanMessage(err: unknown): string {
  return ((err as Error)?.message ?? "").slice(0, 300);
}

function isRateLimit(err: unknown): boolean {
  const msg = messageOf(err);
  return msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted");
}

function isOverloaded(err: unknown): boolean {
  const msg = messageOf(err);
  return msg.includes("503") || msg.includes("unavailable") || msg.includes("overloaded");
}
