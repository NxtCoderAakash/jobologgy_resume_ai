/**
 * Catalog of common Applicant Tracking Systems the Optimizer targets for
 * compatibility. This is informational + a targeting hint for the rewrite — we
 * optimize for general parse-friendliness informed by how these platforms read
 * résumés, not a vendor-specific parser simulation.
 */
export interface AtsSystem {
  key: string;
  name: string;
  /** One or two plain sentences shown in the info dialog. */
  description: string;
  /** Official product website (opened in a new tab from the info dialog). */
  url: string;
  /** Whether it's ticked by default ("considered"). */
  defaultConsidered: boolean;
}

export const ATS_SYSTEMS: AtsSystem[] = [
  {
    key: "workday",
    name: "Workday",
    description:
      "Enterprise HR and recruiting suite used by many large companies. It parses résumés into structured profiles, so standard section headings and a single-column layout matter most.",
    url: "https://www.workday.com",
    defaultConsidered: true,
  },
  {
    key: "greenhouse",
    name: "Greenhouse",
    description:
      "Popular with startups and mid-market tech companies. It emphasizes structured, keyword-based screening against the job's requirements.",
    url: "https://www.greenhouse.io",
    defaultConsidered: true,
  },
  {
    key: "lever",
    name: "Lever",
    description:
      "Applicant tracking plus candidate CRM, common at tech companies. Reads clean, plain-text, single-column résumés most reliably.",
    url: "https://www.lever.co",
    defaultConsidered: true,
  },
  {
    key: "taleo",
    name: "Taleo (Oracle)",
    description:
      "A long-established enterprise ATS, now part of Oracle Recruiting. Known for strict keyword matching and a preference for simple formatting.",
    url: "https://www.oracle.com/human-capital-management/recruiting/",
    defaultConsidered: true,
  },
  {
    key: "icims",
    name: "iCIMS",
    description:
      "An enterprise talent-cloud ATS used by large employers for high-volume hiring and keyword-driven filtering.",
    url: "https://www.icims.com",
    defaultConsidered: true,
  },
  {
    key: "ashby",
    name: "Ashby",
    description:
      "An all-in-one recruiting platform popular with high-growth startups, combining ATS, scheduling and analytics.",
    url: "https://www.ashbyhq.com",
    defaultConsidered: false,
  },
  {
    key: "smartrecruiters",
    name: "SmartRecruiters",
    description:
      "An enterprise hiring platform with a large marketplace of recruiting tools and AI-assisted screening.",
    url: "https://www.smartrecruiters.com",
    defaultConsidered: false,
  },
  {
    key: "bamboohr",
    name: "BambooHR",
    description:
      "HR software with recruiting/ATS features, common at small and mid-size businesses.",
    url: "https://www.bamboohr.com",
    defaultConsidered: false,
  },
];
