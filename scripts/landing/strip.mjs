// Makes the landing page a single page about the system (Sahar, 2026-11-10):
// no menu and no links to other sites or other pages. What stays: links inside
// the page (#contact) and one "התחברות ללקוחות" button to /login.
// Used by import-landing.mjs; run directly to strip public/landing/index.html:
//   node scripts/landing/strip.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function must(html, re, replacement, what) {
  if (!re.test(html)) throw new Error(`strip: not found: ${what}`);
  return html.replace(re, replacement);
}

export function stripLanding(html) {
  // Logo: a picture, not a link.
  html = must(html, /<a class="nav__brand"[^>]*>([\s\S]*?)<\/a>/, '<span class="nav__brand">$1</span>', 'logo link');
  // The menu button and the top links.
  html = must(html, /\s*<div class="nav__group">[\s\S]*?<\/nav>\s*<\/div>/, '', 'menu button + top links');
  // The menu panel (its comment and the panel).
  html = must(html, /\s*<!-- The menu:[\s\S]*?-->/, '', 'menu comment');
  html = must(html, /\s*<div class="menu" id="site-menu"[\s\S]*?<\/button>\s*<\/div>\s*<\/div>(?=\s*<\/header>)/, '', 'menu panel');
  // Breadcrumb to the website.
  html = must(html, /\s*<p class="svc-crumb">[\s\S]*?<\/p>/, '', 'breadcrumb');
  // The CRM section's button to the website (the text about the CRM stays).
  html = must(html, /\s*<a class="cta-btn" href="https:\/\/eriks\.co\.il\/crm\/">[\s\S]*?<\/a>/, '', 'CRM button');
  // Footer: social links and the link columns. The cookie settings button moves next to the copyright.
  html = must(html, /\s*<div class="foot__social-row">[\s\S]*?<\/ul>\s*<\/div>/, '', 'social links');
  html = must(html, /\s*<nav class="foot__nav"[\s\S]*?<\/nav>/, '', 'footer links');
  html = must(
    html,
    /<p class="foot__copy">([\s\S]*?)<\/p>/,
    '<p class="foot__copy">$1 <button class="foot__consent" type="button" data-open-consent>הגדרות עוגיות</button></p>',
    'copyright',
  );
  // Accessibility panel and cookie banner: links to pages on the website.
  html = must(html, /\s*<a href="[^"]*\/accessibility\/">הצהרת נגישות<\/a>/, '', 'accessibility statement link');
  html = must(html, /\s*<a href="[^"]*\/privacy\/#cookies">מה זה אומר<\/a>/, '', 'cookies link');

  // Anything left that leaves the page is a mistake.
  const away = [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)]
    .map((m) => m[1])
    .filter((h) => !h.startsWith('#') && h !== '/login');
  if (away.length) throw new Error(`strip: links still leave the page: ${away.join(', ')}`);
  return html;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = resolve(new URL('../..', import.meta.url).pathname, 'public/landing/index.html');
  writeFileSync(file, stripLanding(readFileSync(file, 'utf8')));
  console.log('Landing stripped:', file);
}
