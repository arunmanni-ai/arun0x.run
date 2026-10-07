import { readdir, readFile, writeFile, mkdir, rm, cp, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { escapeHtml as e, safeBase, renderBlocks, validateEntry, headingId } from './render.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'docs');
const base = safeBase(process.env.SITE_BASE_PATH || '');
const href = route => `${base}${route}`;
const origin = 'https://arun0x.run';
const assetVersion = async file => createHash('sha256').update(await readFile(path.join(root, file))).digest('hex').slice(0, 12);
const styleVersion = await assetVersion('src/styles.css');
const scriptVersion = await assetVersion('src/site.js');
const arrow = '<svg class="arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 13 13 3M4 3h9v9" stroke="currentColor" stroke-width="1.1"/></svg>';
const leader = '<svg viewBox="0 0 115 70" aria-hidden="true"><path class="leader" d="M3 65 72 8h40"/><circle class="node" cx="3" cy="65" r="2.5"/></svg>';
const paths = ['/','/archive/','/notes/','/about/','/methods/'];

async function copyAssets(source, destination, relative = '') {
  for (const name of await readdir(source)) {
    const asset = relative + name;
    const from = path.join(source, name);
    const to = path.join(destination, name);
    const info = await lstat(from);
    if (!/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9]+)?$/.test(name) || info.isSymbolicLink()) throw new Error(`Unsafe asset: ${asset}`);
    if (info.isDirectory()) {
      await mkdir(to, {recursive:true});
      await copyAssets(from, to, asset + '/');
    } else {
      // The favicon is reviewed source code. Content assets must be raster images.
      if (!info.isFile() || (!/\.(?:webp|png|jpg|jpeg)$/.test(name) && asset !== 'favicon.svg')) throw new Error(`Unsupported asset: ${asset}`);
      await cp(from, to);
    }
  }
}

async function entries(kind) {
  const dir = path.join(root, 'content', kind);
  const names = (await readdir(dir)).filter(name => name.endsWith('.json'));
  const records = [];
  const slugs = new Set();
  for (const name of names) {
    const entry = validateEntry(JSON.parse(await readFile(path.join(dir, name), 'utf8')));
    if (slugs.has(entry.slug)) throw new Error(`Duplicate slug in ${kind}: ${entry.slug}`);
    slugs.add(entry.slug);
    renderBlocks(entry.blocks, base);
    if (entry.status === 'published') records.push(entry);
  }
  return records.sort((a,b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}
const posts = await entries('posts');
const notes = await entries('notes');
const nav = current => `<a class="skip-link" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="${href('/')}" aria-label="arun0x.run home">arun<span class="zero">0</span>x.run</a><nav class="site-nav" aria-label="Main navigation">${['Archive','Notes','About'].map(label => `<a href="${href(`/${label.toLowerCase()}/`)}"${current === label.toLowerCase() ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav></header>`;
const githubLink = (className = '') => `<a${className ? ` class="${className}"` : ''} href="https://github.com/arunmanni-ai" rel="noopener noreferrer">GitHub</a>`;
const footer = () => `<footer class="page-footer"><p>Arun / Independent research</p><div class="footer-links">${githubLink()}<a href="${href('/methods/')}">Research methods ${arrow}</a></div></footer>`;
function document({title, description, route, content, home = false, noindex = false}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#060707">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests">
<meta name="referrer" content="no-referrer">
<title>${e(title)} · arun0x.run</title>
<meta name="description" content="${e(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${origin}${route}">`}
<meta property="og:type" content="website">
<meta property="og:title" content="${e(title)} · arun0x.run">
<meta property="og:description" content="${e(description)}">
<meta property="og:url" content="${origin}${route}">
<link rel="icon" href="${href('/assets/favicon.svg')}" type="image/svg+xml">
<link rel="stylesheet" href="${href('/assets/styles.css')}?v=${styleVersion}">
${home ? `<link rel="preload" as="image" href="${href('/assets/archive.webp')}" imagesrcset="${href('/assets/archive-small.webp')} 960w, ${href('/assets/archive.webp')} 1536w" imagesizes="(max-width: 900px) 960px, 100vw">` : ''}
<script src="${href('/assets/site.js')}?v=${scriptVersion}" defer></script>
</head>
<body>${content}</body>
</html>\n`;
}
async function save(route, html) {
  const dest = route === '/404.html' ? path.join(out, '404.html') : path.join(out, route.slice(1), 'index.html');
  await mkdir(path.dirname(dest), {recursive:true});
  await writeFile(dest, html);
}
function heading(number, title, lede) {
  return `<div class="page-heading"><p class="eyebrow">${number} / ${e(title)}</p><h1>${e(title)}</h1><p class="lede">${e(lede)}</p></div>`;
}
async function page(route, current, title, description, inner, noindex = false) {
  await save(route, document({title, description, route, noindex, content: `<div class="page-shell">${nav(current)}<main id="main" class="page-main">${inner}</main>${footer()}</div>`}));
}
await rm(out, {recursive:true, force:true});
await mkdir(path.join(out,'assets'), {recursive:true});
await copyAssets(path.join(root,'src/assets'), path.join(out,'assets'));
await cp(path.join(root,'src/styles.css'),path.join(out,'assets/styles.css'));
await cp(path.join(root,'src/site.js'),path.join(out,'assets/site.js'));
const newest = posts[0];
const featuredTitle = newest ? e(newest.title) : 'The first investigation';
const featuredDescription = newest ? e(newest.description) : 'The archive takes shape with each published writeup.';
const featuredLink = newest ? href(`/archive/${newest.slug}/`) : href('/about/');
const featuredLabel = newest ? 'Read the investigation' : 'About the research';
const home = `<div class="home-shell">${nav('')}
<main id="main">
<div class="home-title"><h1>The unresolved archive.</h1><p>Kernel research, reverse engineering, and the questions still open.</p></div>
<div id="visual-view" class="visual-view">
<img class="archive-art" src="${href('/assets/archive.webp')}" srcset="${href('/assets/archive-small.webp')} 960w, ${href('/assets/archive.webp')} 1536w" sizes="(max-width: 900px) 960px, 100vw" width="1536" height="1024" alt="" fetchpriority="high" decoding="async">
<section class="investigation" aria-label="Featured investigation"><svg class="investigation-leader" viewBox="0 0 120 90" aria-hidden="true"><path class="leader" d="M2 86 65 8h53"/><circle class="node" cx="2" cy="86" r="2.6"/></svg><p class="eyebrow">01 / ${newest ? 'Published' : 'In progress'}</p><h2>${featuredTitle}</h2><p>${featuredDescription}</p><a class="text-link" href="${featuredLink}">${featuredLabel} ${arrow}</a></section>
<a class="hotspot hotspot-notes" href="${href('/notes/')}">${leader}<span>Notes</span></a>
<a class="hotspot hotspot-methods" href="${href('/methods/')}"><svg viewBox="0 0 115 70" aria-hidden="true"><path class="leader" d="M3 8 88 39h25"/><circle class="node" cx="3" cy="8" r="2.5"/></svg><span>Methods</span></a>
</div>
<div id="text-view" class="text-view" hidden><p class="eyebrow">Independent security research</p><p class="reading-intro">Following the details. Documenting what holds up. Keeping the open questions visible.</p><div class="reading-list">${[
  ['01','Archive',newest ? 'Investigations and published writeups.' : 'The first writeup is still in progress.','/archive/'],
  ['02','Notes','Observations, smaller findings, and loose ends.','/notes/'],
  ['03','Methods','How the research is approached and documented.','/methods/'],
  ['04','About','The person and intent behind this archive.','/about/']
].map(([num,title,desc,link]) => `<a class="reading-row" href="${href(link)}"><span>${num}</span><div><h2>${title}</h2><p>${desc}</p></div>${arrow}</a>`).join('')}</div></div>
</main>
<footer class="home-footer"><div class="status-rail"><div><label class="reading-toggle" hidden><input id="reading-view" type="checkbox" aria-controls="visual-view text-view"><span>Reading view</span></label></div><p class="status-message">${newest ? 'The archive is open.' : 'First writeup coming soon.'}</p><a class="rail-link" href="${href('/notes/')}">Explore notes ${arrow}</a></div><div class="footer-meta"><p class="signature">Arun / Independent research</p>${githubLink('footer-social')}</div></footer>
</div>`;
await save('/', document({title:'The unresolved archive',description:'Independent security research by Arun. Kernel research, reverse engineering, and the questions still open.', route:'/', content:home, home:true}));

function listing(records, kind) {
  return records.map(entry => `<a class="post-row" href="${href(`/${kind}/${entry.slug}/`)}"><div><span class="post-meta"><time datetime="${entry.date}">${e(entry.date)}</time>${entry.tags?.length ? ' / '+ entry.tags.map(e).join(' · ') : ''}</span><h2>${e(entry.title)}</h2><p>${e(entry.description)}</p></div>${arrow}</a>`).join('');
}
await page('/archive/','archive','The archive','Published security research, investigations, and open questions.',`${heading('01','The archive','Long-form investigations into kernels, binaries, and the boundaries between expected and actual behavior.')}<div class="index-label"><p>Published investigations</p><p>${String(posts.length).padStart(2,'0')} entries</p></div>${posts.length ? listing(posts,'archive') : '<section class="empty-state"><p class="index-number">01 / IN PROGRESS</p><h2>The first investigation.</h2><p>The archive begins with the first published writeup. Until then, this space stays open.</p><a class="text-link" href="'+href('/methods/')+'">Read the research approach '+arrow+'</a></section>'}`);
await page('/notes/','notes','Field notes','Smaller findings, observations, and unresolved questions from security research.',`${heading('02','Field notes','Observations from the workbench. Smaller findings, useful details, and questions that deserve another look.')}<div class="index-label"><p>Research notes</p><p>${String(notes.length).padStart(2,'0')} entries</p></div>${notes.length ? listing(notes,'notes') : '<section class="empty-state"><p class="index-number">00 / NOT YET PUBLISHED</p><h2>Room for the loose ends.</h2><p>No notes published yet. This is where the smaller discoveries will live, alongside the longer investigations.</p><a class="text-link" href="'+href('/archive/')+'">Visit the archive '+arrow+'</a></section>'}`);
await page('/about/','about','About the research','Arun’s independent archive of security research, reverse engineering, and open questions.',`${heading('03','About the research','An independent archive by Arun. A place for the work, the evidence, and the questions still open.')}<div class="prose"><h2>Follow the details.</h2><p>This archive is being built around kernel research and reverse engineering: understanding how systems behave, where assumptions break, and what the evidence actually supports.</p><p>The aim is to make each writeup useful to someone retracing the investigation. Enough context to follow the reasoning. Enough detail to reproduce the observation. A clear distinction between a finding and a hypothesis.</p><h2>An archive in progress.</h2><p>The first writeup is still ahead. Future investigations and field notes will appear here as they are ready to share.</p><div class="about-links"><a class="text-link" href="${href('/methods/')}">The research approach ${arrow}</a><a class="text-link" href="https://github.com/arunmanni-ai" rel="noopener noreferrer">GitHub / arunmanni-ai ${arrow}</a></div></div>`);
const methods = [
['01','Observe before assuming.','Start with a specific behavior or question. Keep a record of what was observed and what is still uncertain.'],
['02','Make it reproducible.','Document the relevant environment, versions, inputs, and steps. Keep the evidence close to the claim it supports.'],
['03','Separate evidence from inference.','Explain what the results establish, which interpretations remain possible, and where the investigation reaches its limits.'],
['04','Publish with care.','Research in controlled, authorized environments. Handle vulnerability disclosure appropriately and remove private data before sharing.']
];
await page('/methods/','','Research methods','The approach behind the archive: observation, reproducibility, evidence, and careful publication.',`${heading('04','Research methods','The principles this archive is built to follow.')}<div>${methods.map(([num,title,text])=>`<section class="method-row"><span class="number">${num}</span><div><h2>${title}</h2><p>${text}</p></div></section>`).join('')}</div>`);
for (const [kind, records] of [['archive',posts],['notes',notes]]) {
  for (const entry of records) {
    const route = `/${kind}/${entry.slug}/`;
    paths.push(route);
    const headings = entry.blocks.filter(block => block.type === 'heading');
    const wordCount = entry.blocks.map(block => block.text || block.items?.join(' ') || '').join(' ').trim().split(/\s+/).length;
    const minutes = Math.max(1, Math.ceil(wordCount / 200));
    await page(route,kind,entry.title,entry.description,`<a class="back-link" href="${href(`/${kind}/`)}">← Back to ${kind === 'archive' ? 'archive' : 'notes'}</a><div class="page-heading"><p class="eyebrow"><time datetime="${e(entry.date)}">${e(entry.date)}</time> / ${minutes} min read${entry.tags?.length ? ' / '+entry.tags.map(e).join(' · ') : ''}</p><h1>${e(entry.title)}</h1><p class="lede">${e(entry.description)}</p></div><div class="article-layout"><article class="prose" aria-label="${e(entry.title)}">${renderBlocks(entry.blocks,base)}</article>${headings.length ? `<nav class="article-nav" aria-label="On this page"><p>On this page</p>${headings.map(block=>`<a href="#${headingId(block.id)}">${e(block.text)}</a>`).join('')}</nav>` : ''}</div>`);
  }
}
await page('/404.html','','Page not found','This path does not lead to a published page.',`${heading('404','An unresolved path.','This page may have moved, or it has not been published yet.')}<a class="text-link" href="${href('/')}">Return to the archive ${arrow}</a>`,true);
await writeFile(path.join(out,'CNAME'),'arun0x.run\n');
await writeFile(path.join(out,'.nojekyll'),'');
await writeFile(path.join(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(route=>`<url><loc>${origin}${route}</loc></url>`).join('')}</urlset>\n`);
console.log(`Built ${paths.length} pages + 404. Published investigations: ${posts.length}; notes: ${notes.length}. Base path: ${base || '/'}.`);
