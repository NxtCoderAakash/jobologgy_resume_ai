/**
 * Render an HTML string to a PDF Buffer via Puppeteer. A single browser instance is reused.
 */
import puppeteer, { type Browser } from "puppeteer";

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      })
      .then((browser) => {
        // If Chrome crashes or is disconnected, drop the cached instance so the
        // next render relaunches instead of reusing a dead browser forever.
        browser.on("disconnected", () => {
          browserPromise = null;
        });
        return browser;
      })
      .catch((err) => {
        // Never cache a rejected launch — otherwise one transient failure at boot
        // would permanently break PDF generation until a process restart.
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

export interface PdfOptions {
  /**
   * Let the document's own CSS `@page` rules control page size AND margins.
   * Templates use this so every page (not just the first) gets proper margins —
   * with `margin:0` here the template's padding only applies once, so page 2+
   * content hugs the top edge.
   */
  cssPageSize?: boolean;
}

export async function htmlToPdf(html: string, opts: PdfOptions = {}): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = opts.cssPageSize
      ? await page.pdf({ printBackground: true, preferCSSPageSize: true })
      : await page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "0", bottom: "0", left: "0", right: "0" },
        });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}
