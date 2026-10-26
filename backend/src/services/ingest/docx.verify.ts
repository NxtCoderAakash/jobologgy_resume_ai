/**
 * Phase-2 DOCX verification: pure detectors on OOXML snippets + a real round-trip
 * on a minimal crafted .docx (table + body contact, and a header-only variant).
 * Run:  npx tsx src/services/ingest/docx.verify.ts
 */
import JSZip from "jszip";
import { docxHasTables, docxHasTextBoxes, docxColumnCount, xmlRunText, inspectDocx } from "./docxInspect.js";
import { pillar1Gates } from "./pillar1.js";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
}

// ---- pure detector unit checks ----
console.log("[detectors]");
check("tables: detects <w:tbl>", docxHasTables("<w:body><w:tbl><w:tr/></w:tbl></w:body>"));
check("tables: none in plain body", !docxHasTables("<w:body><w:p><w:r><w:t>hi</w:t></w:r></w:p></w:body>"));
check("textboxes: detects <w:txbxContent>", docxHasTextBoxes("<w:drawing><w:txbxContent><w:p/></w:txbxContent></w:drawing>"));
check("columns: w:num=2 → 2", docxColumnCount('<w:sectPr><w:cols w:num="2" w:space="400"/></w:sectPr>') === 2);
check("columns: default → 1", docxColumnCount("<w:sectPr><w:pgSz/></w:sectPr>") === 1);
check("runText joins <w:t>", xmlRunText("<w:t>Hello</w:t><w:t> World</w:t>") === "Hello World");

// ---- minimal valid .docx round-trips ----
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const p = (t: string) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;

async function buildDocx(parts: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", RELS);
  for (const [path, xml] of Object.entries(parts)) zip.file(path, xml);
  return zip.generateAsync({ type: "nodebuffer" });
}

async function main() {
  // Variant 1: table + contact in body
  {
    const doc = `<?xml version="1.0"?><w:document ${NS}><w:body>
      ${p("Ankit Verma")}
      ${p("ankit.verma@example.com | +91 98765 43210 | Bengaluru")}
      ${p("Experience")}
      <w:tbl><w:tr><w:tc>${p("QA Analyst (Jun 2021 - Present)")}</w:tc></w:tr></w:tbl>
      ${p("Education")}${p("Skills")}
    </w:body></w:document>`;
    const buf = await buildDocx({ "word/document.xml": doc });
    const m = await inspectDocx(buf);
    console.log("\n[docx: table + body contact]");
    check("D1 textSelectable", m.textSelectable);
    check("D1 hasTables", m.hasTables);
    check("D1 contact in body", m.contact.inBody, JSON.stringify(m.contact));
    check("D1 headings found", ["Experience", "Education", "Skills"].every((h) => m.headings.includes(h)), m.headings.join(","));
    check("D1 contact_in_body gate passes", pillar1Gates(m).find((g) => g.id === "contact_in_body")?.passed === true);
  }

  // Variant 2: two columns + text box + contact only in header
  {
    const doc = `<?xml version="1.0"?><w:document ${NS}><w:body>
      ${p("Ankit Verma")}${p("Bengaluru, India")}
      <w:p><w:r><w:drawing><w:txbxContent>${p("boxed content")}</w:txbxContent></w:drawing></w:r></w:p>
      ${p("Experience")}${p("Education")}${p("Skills")}
      <w:sectPr><w:cols w:num="2" w:space="400"/></w:sectPr>
    </w:body></w:document>`;
    const header = `<?xml version="1.0"?><w:hdr ${NS}>${p("ankit.verma@example.com | +91 98765 43210")}</w:hdr>`;
    const buf = await buildDocx({ "word/document.xml": doc, "word/header1.xml": header });
    const m = await inspectDocx(buf);
    console.log("\n[docx: 2-col + textbox + header-only contact]");
    check("D2 two columns", m.columns.count === 2);
    check("D2 single_column gate FAILS", pillar1Gates(m).find((g) => g.id === "single_column")?.passed === false);
    check("D2 content in text boxes", m.contentInTextBoxes);
    check("D2 core_content_not_boxed gate FAILS", pillar1Gates(m).find((g) => g.id === "core_content_not_boxed")?.passed === false);
    check("D2 contact found", m.contact.found, JSON.stringify(m.contact));
    check("D2 contact NOT in body", m.contact.inBody === false);
    check("D2 headerFooterOnly", m.contact.headerFooterOnly === true);
    check("D2 contact_in_body gate FAILS", pillar1Gates(m).find((g) => g.id === "contact_in_body")?.passed === false);
  }

  console.log(`\n${failed === 0 ? "ALL GREEN" : "FAILURES"} — ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
