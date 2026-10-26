/**
 * JD requirement extraction (Phase 3→wiring) — PROVISIONAL deterministic version.
 *
 * Pulls candidate skill requirements from a raw JD using a curated tech dictionary
 * so the whole V2 pipeline runs without an extra AI call for a flagged preview.
 * The constrained-AI layer replaces this with proper requirement parsing later
 * (this only recognises known tech terms + their surrounding sentence for tiering).
 */
import { classifyRequirement, type TieredRequirement } from "./jdTiering.js";

const TECH = [
  "javascript", "typescript", "react native", "react", "angular", "vue", "node.js", "python", "java", "c++", "c#", "go", "rust",
  "sql", "postgresql", "mysql", "mongodb", "redis", "aws", "azure", "gcp", "docker", "kubernetes", "jenkins", "ci/cd",
  "git", "selenium", "cypress", "playwright", "postman", "rest", "graphql", "jira", "agile", "scrum", "testng", "junit",
  "pytest", "html", "css", "tailwind", "terraform", "linux", "bash", "kafka", "spark", "tableau", "power bi", "figma", "swagger",
];

function hasWord(text: string, form: string): boolean {
  const esc = form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9+#])${esc}([^a-z0-9+#]|$)`, "i").test(text);
}

export interface ExtractedJd {
  roleTitle: string;
  requirements: TieredRequirement[];
  jdTokenCount: number;
}

export function extractRequirements(jd: string): ExtractedJd {
  const text = jd.trim();
  const roleTitle = (text.split(/\n/)[0] || "").slice(0, 60).trim();
  const sentences = text.split(/\n|(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const jdTokenCount = text.split(/\s+/).filter(Boolean).length;

  const seen = new Set<string>();
  const requirements: TieredRequirement[] = [];
  for (const tech of TECH) {
    if (seen.has(tech)) continue;
    // react-native should not also match as plain "react"
    const sentence = sentences.find((s) => hasWord(s, tech));
    if (!sentence) continue;
    // skip "react" if this sentence was already consumed by "react native"
    if (tech === "react" && requirements.some((r) => r.skill === "react native" && hasWord(sentence, "react native"))) continue;
    seen.add(tech);
    requirements.push(classifyRequirement(sentence, tech, roleTitle));
  }
  return { roleTitle, requirements, jdTokenCount };
}
