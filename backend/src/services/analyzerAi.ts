/**
 * Score-only résumé analysis against a job description. No rewriting.
 * Uses the builder's generic structured-JSON Gemini client — the optimizer's
 * gemini.ts is untouched.
 */
import { SchemaType } from "@google/generative-ai";
import { generateStructuredJson } from "./geminiClient.js";
import { analyzerResultSchema, type AnalyzerResult } from "../types/analyzer.js";

function strArray() {
  return { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } };
}
function dimension() {
  return {
    type: SchemaType.OBJECT,
    properties: {
      score: { type: SchemaType.NUMBER },
      comment: { type: SchemaType.STRING },
    },
    required: ["score", "comment"],
  };
}

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    atsScore: { type: SchemaType.NUMBER },
    verdict: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    scoreBreakdown: {
      type: SchemaType.OBJECT,
      properties: {
        keywordMatch: dimension(),
        relevanceToJD: dimension(),
        formatting: dimension(),
        impactMetrics: dimension(),
      },
      required: ["keywordMatch", "relevanceToJD", "formatting", "impactMetrics"],
    },
    keywordAnalysis: {
      type: SchemaType.OBJECT,
      properties: {
        jdKeywords: strArray(),
        matched: strArray(),
        missing: strArray(),
      },
      required: ["jdKeywords", "matched", "missing"],
    },
    strengths: strArray(),
    gaps: strArray(),
    recommendations: strArray(),
  },
  required: [
    "atsScore",
    "verdict",
    "summary",
    "scoreBreakdown",
    "keywordAnalysis",
    "strengths",
    "gaps",
    "recommendations",
  ],
};

const SYSTEM_PROMPT = `You are an expert technical recruiter and ATS (Applicant Tracking System)
specialist. You will receive a candidate's RÉSUMÉ text and a target JOB DESCRIPTION (JD).

Assess how well the résumé — AS IT IS — fits the JD. Do NOT rewrite anything.

Produce:
1. "atsScore" (0-100): overall ATS fit of this résumé for this JD.
2. "verdict": a 2-4 word label matching the score, e.g. "Excellent match", "Strong match",
   "Promising, needs work", "Weak match".
3. "summary": 2-3 honest sentences on overall fit.
4. "scoreBreakdown": score + one-line comment per dimension:
   - keywordMatch: how many of the JD's key skills/terms appear in the résumé
   - relevanceToJD: how relevant the experience/seniority is to this role
   - formatting: ATS-parseability and structure of the résumé text
   - impactMetrics: use of quantified, outcome-focused achievements
5. "keywordAnalysis": the JD's important keywords, which are matched in the résumé,
   and which are missing.
6. "strengths": 3-5 concrete things this résumé does well for this JD.
7. "gaps": 3-5 concrete things holding the score down.
8. "recommendations": 3-6 specific, actionable edits the candidate could make
   (phrased as advice — you are not making the edits).

HARD RULES:
- Judge only what is actually in the résumé; never assume unstated skills.
- Be realistic and consistent: the dimension scores should support the overall score.
- Keep every list item short (one sentence max) and plain text.
- Respond with ONLY the JSON object.`;

export async function scoreResume(params: {
  resumeText: string;
  jobDescription: string;
}): Promise<AnalyzerResult> {
  return generateStructuredJson({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `RÉSUMÉ:\n"""\n${params.resumeText}\n"""\n\nJOB DESCRIPTION:\n"""\n${params.jobDescription}\n"""`,
    responseSchema,
    zodSchema: analyzerResultSchema,
    temperature: 0.3,
  });
}
