/**
 * AI services for Résumé Studio:
 *  - structureResume(): raw résumé text -> structured, editable CV JSON (no JD required)
 *  - suggestForField(): one field's text -> a reviewed-before-apply rephrasing + bullet ideas
 */
import { SchemaType } from "@google/generative-ai";
import { generateStructuredJson } from "./geminiClient.js";
import {
  builderCvSchema,
  suggestionSchema,
  type BuilderCv,
  type Suggestion,
  type SuggestRequest,
} from "../types/builder.js";

function strArray() {
  return { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } };
}

const cvResponseSchema = {
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
  required: ["fullName", "title", "contact", "summary", "skills", "experience", "education"],
};

const STRUCTURE_PROMPT = `You are a résumé parser. You will receive the raw text of a candidate's
résumé. Convert it into the provided JSON structure.

HARD RULES:
- Copy the candidate's real information. NEVER invent employers, titles, dates, degrees,
  skills, or contact details that are not in the text.
- If a field is not present in the text, use an empty string (or empty array). Do NOT guess.
- Keep the candidate's original wording for bullets (light cleanup of spacing/typos only).
- Dates: keep them as human-readable strings exactly like "Jul 2021 – Present" or "2019".
- Preserve the order sections appear in the résumé.
- Respond with ONLY the JSON object.`;

export async function structureResume(resumeText: string): Promise<BuilderCv> {
  return generateStructuredJson({
    systemPrompt: STRUCTURE_PROMPT,
    userPrompt: `RÉSUMÉ TEXT:\n"""\n${resumeText}\n"""`,
    responseSchema: cvResponseSchema,
    zodSchema: builderCvSchema,
    temperature: 0.15, // parsing, not creativity
  });
}

const suggestResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    rephrased: { type: SchemaType.STRING },
    bulletIdeas: strArray(),
  },
  required: ["rephrased", "bulletIdeas"],
};

const SUGGEST_PROMPT = `You are an expert résumé writer. You will receive ONE piece of résumé text
plus optional context. Produce:
1. "rephrased": an improved version of the SAME content — stronger action verbs, concise,
   quantified where the original implies it, ATS-friendly plain text. Same facts, same person.
2. "bulletIdeas": 2-4 SHORT additional bullet-point ideas the candidate could add, phrased as
   suggestions grounded ONLY in what the text/context already implies (e.g. surface an implied
   skill or outcome). Never invent employers, numbers, tools, or achievements not implied.

HARD RULES:
- NEVER fabricate facts, metrics, employers, dates, or technologies.
- Keep "rephrased" roughly the same length or shorter than the original.
- If the input text is empty or too thin to improve, return the original text unchanged in
  "rephrased" and put general phrasing tips in "bulletIdeas".
- Plain text only: no markdown, no emojis, no bullet symbols inside strings.
- Respond with ONLY the JSON object.`;

export async function suggestForField(req: SuggestRequest): Promise<Suggestion> {
  const contextBits = [
    req.kind === "summary" && "This text is a professional summary (2-4 sentences).",
    req.kind === "bullets" && "This text is a set of work-experience bullet points (one per line).",
    req.kind === "description" && "This text is a project description.",
    req.role && `Candidate's role: ${req.role}`,
    req.company && `Company: ${req.company}`,
    req.jobDescription &&
      `Target job description (tailor wording toward it, without inventing skills):\n${req.jobDescription}`,
  ]
    .filter(Boolean)
    .join("\n");

  return generateStructuredJson({
    systemPrompt: SUGGEST_PROMPT,
    userPrompt: `${contextBits}\n\nTEXT TO IMPROVE:\n"""\n${req.text}\n"""`,
    responseSchema: suggestResponseSchema,
    zodSchema: suggestionSchema,
    temperature: 0.5,
  });
}
