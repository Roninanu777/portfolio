// Structural check of the built PDFs, read straight from the PDF bytes (no dependencies):
// exactly one page, and every font embedded as a real Type0 font (no Type3 glyph fonts,
// which some applicant-tracking parsers cannot read).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fileName = 'Roni-Pradhan-Senior-Software-Engineer.pdf';
const files = [
  { label: 'public', file: path.resolve(here, '..', 'assets', fileName), required: true },
  { label: 'private', file: path.join(here, 'out', fileName), required: false },
];

let failed = false;
for (const f of files) {
  if (!fs.existsSync(f.file)) {
    if (f.required) { console.error(`FAIL ${f.label}: missing ${f.file}`); failed = true; }
    continue;
  }
  const s = fs.readFileSync(f.file).toString('latin1');
  const pages = (s.match(/\/Type\s*\/Page(?!s)/g) || []).length;
  const type0 = (s.match(/\/Subtype\s*\/Type0/g) || []).length;
  const type3 = (s.match(/\/Subtype\s*\/Type3/g) || []).length;
  const ok = pages === 1 && type0 > 0 && type3 === 0;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${f.label}: pages=${pages} type0-fonts=${type0} type3-fonts=${type3}`);
  if (!ok) failed = true;
}
if (failed) {
  console.error('resume check failed: keep resume.html to one page and on the local fonts, then rebuild');
  process.exit(1);
}
