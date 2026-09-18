// Prints resume.html to text-based PDFs through headless Chromium.
// Run via ./build.sh, which installs Playwright locally and checks the output.
//
// Outputs from the one source:
//   ../assets/Roni-Pradhan-Senior-Software-Engineer.pdf   public copy for the website (no phone)
//   out/Roni-Pradhan-Senior-Software-Engineer.pdf         private copy for applications (with phone),
//                                                         only when a phone number is configured
//
// Phone number: the RESUME_PHONE environment variable, or the first line of ./.private.
// Both stay off GitHub (.private is gitignored).
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, 'resume.html');
const fileName = 'Roni-Pradhan-Senior-Software-Engineer.pdf';
const outPublic = path.resolve(here, '..', 'assets', fileName);
const outPrivate = path.join(here, 'out', fileName);

const privateFile = path.join(here, '.private');
const phone = (process.env.RESUME_PHONE
  || (fs.existsSync(privateFile) ? fs.readFileSync(privateFile, 'utf8').split('\n')[0] : '')).trim();

const pdfOptions = { format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false };

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + src, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);

await page.pdf({ ...pdfOptions, path: outPublic });
console.log('wrote', path.relative(process.cwd(), outPublic), '(public, no phone)');

if (phone) {
  fs.mkdirSync(path.dirname(outPrivate), { recursive: true });
  await page.evaluate((p) => {
    const el = document.querySelector('.phone');
    const a = document.createElement('a');
    a.href = 'tel:' + p.replace(/[^+\d]/g, '');
    a.textContent = p;
    el.replaceChildren(a);
    el.hidden = false;
  }, phone);
  await page.pdf({ ...pdfOptions, path: outPrivate });
  console.log('wrote', path.relative(process.cwd(), outPrivate), '(private, with phone)');
} else {
  console.log('no phone configured: skipped the private copy (set RESUME_PHONE or create resume/.private)');
}

await browser.close();
