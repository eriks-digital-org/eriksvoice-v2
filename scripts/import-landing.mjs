// Copies the EriksVoice page of the Eriks Digital website into this app.
//
// The landing page at "/" is the voice page (voice/index.html) of Sahar's Vite
// site "eriks-digital-website". It is built there and copied here as static
// files, so it looks exactly like the original.
//
// Usage, from the website folder:
//   npx vite build -c vite.voice.config.js      (builds only voice/index.html into dist-voice/)
//   node <this repo>/scripts/import-landing.mjs <website folder>
//
// vite.voice.config.js is in scripts/landing/ in this repo; copy it into the
// website folder first. Links to the rest of the website point to eriks.co.il.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const site = resolve(process.argv[2] ?? '.');
const dist = join(site, 'dist-voice');
const out = resolve(new URL('..', import.meta.url).pathname, 'public');
if (!existsSync(join(dist, 'voice/index.html'))) {
  console.error(`No build in ${dist}. Run: npx vite build -c vite.voice.config.js`);
  process.exit(1);
}

const MAIN_SITE = 'https://eriks.co.il';
let html = readFileSync(join(dist, 'voice/index.html'), 'utf8');

// Links to other pages of the website go to eriks.co.il; this page is "/".
html = html
  .replace(/href="\/voice\/"/g, 'href="/"')
  .replace(/href="\/(#[\w-]+)"/g, `href="${MAIN_SITE}/$1"`)
  .replace(/href="\/((?:crm|blog|terms|privacy|accessibility)\/)"/g, `href="${MAIN_SITE}/$1"`)
  .replace(/(<a class="nav__brand") href="\/"/, `$1 href="${MAIN_SITE}/"`)
  .replace(/(<p class="svc-crumb"><a) href="\/"/, `$1 href="${MAIN_SITE}/"`)
  // "התחברות ללקוחות" opens the system's login (on the website it said "soon").
  .replace(/href="#" data-login/g, 'href="/login"');

// A way into the system: "כניסה" in the top links and in the menu.
html = html.replace(
  /(<nav class="nav__links"[^>]*>)/,
  '$1\n          <a href="/login">כניסה</a>',
);
html = html.replace(
  /(<li><a href="#contact"><b>10<\/b>צור קשר<\/a><\/li>)/,
  '$1\n            <li><a href="/login"><b>11</b>כניסה למערכת</a></li>',
);

mkdirSync(join(out, 'landing'), { recursive: true });
writeFileSync(join(out, 'landing/index.html'), html);

rmSync(join(out, 'landing-assets'), { recursive: true, force: true });
cpSync(join(dist, 'landing-assets'), join(out, 'landing-assets'), { recursive: true });

// Images, sounds and backgrounds the page uses (the agents are picked in code,
// so the whole folder is copied).
const used = new Set();
const texts = [html, ...readdirSync(join(dist, 'landing-assets')).map((f) => readFileSync(join(dist, 'landing-assets', f), 'utf8'))];
for (const t of texts) for (const m of t.matchAll(/\/(bg|brand|work)\/[\w./-]+\.(?:webp|svg|png|jpg|mp3)/g)) used.add(m[0]);
cpSync(join(site, 'public/agents'), join(out, 'agents'), { recursive: true });
for (const file of used) {
  const from = join(site, 'public', file);
  if (!existsSync(from)) continue;
  mkdirSync(join(out, file, '..'), { recursive: true });
  cpSync(from, join(out, file));
}
console.log(`Landing copied: ${used.size} images + agents + ${readdirSync(join(dist, 'landing-assets')).length} assets.`);
