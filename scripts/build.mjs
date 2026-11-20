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
const stageVersion = await assetVersion('src/stage.js');
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

/* ---- shared chrome -------------------------------------------------- */

const masthead = current => `<a class="skip-link" href="#main">Skip to content</a><header class="masthead"><a class="brand" href="${href('/')}">arun0x.run</a><nav aria-label="Main">${[['Archive','archive'],['Notes','notes'],['Methods','methods'],['About','about']].map(([label,slug]) => `<a href="${href(`/${slug}/`)}"${current === slug ? ' aria-current="page"' : ''}>${label.toLowerCase()}</a>`).join('')}</nav></header>`;

const footer = () => `<footer class="footer"><p>Arun. Independent security research.</p><div><a href="${href('/methods/')}">Methods</a><a href="https://github.com/arunmanni-ai" rel="noopener noreferrer">GitHub</a></div></footer>`;

function pagehead(title, lede, stamp = '', back = '') {
  return `<section class="rail pagehead"><div class="mark" aria-hidden="true"></div><div class="col">${back}${stamp ? `<p class="stamp">${stamp}</p>` : ''}<h1>${e(title)}</h1><p class="lede">${e(lede)}</p></div></section>`;
}

function document({title, description, route, content, noindex = false, home = false}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#080b10">
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
<script src="${href('/assets/site.js')}?v=${scriptVersion}" defer></script>
${home ? `<script src="${href('/assets/stage.js')}?v=${stageVersion}" defer></script>` : ''}
</head>
<body>${content}</body>
</html>\n`;
}

async function save(route, html) {
  const dest = route === '/404.html' ? path.join(out, '404.html') : path.join(out, route.slice(1), 'index.html');
  await mkdir(path.dirname(dest), {recursive:true});
  await writeFile(dest, html);
}

// Every page closes with an empty rail segment so the hairline reaches the footer.
const tail = '<div class="rail tail"><div class="mark" aria-hidden="true"></div><div class="col"></div></div>';

async function page(route, current, title, description, inner, noindex = false) {
  await save(route, document({title, description, route, noindex, content: `<div class="shell">${masthead(current)}<main id="main">${inner}${tail}</main>${footer()}</div>`}));
}

await rm(out, {recursive:true, force:true});
await mkdir(path.join(out,'assets'), {recursive:true});
await copyAssets(path.join(root,'src/assets'), path.join(out,'assets'));
await cp(path.join(root,'src/styles.css'),path.join(out,'assets/styles.css'));
await cp(path.join(root,'src/site.js'),path.join(out,'assets/site.js'));
await cp(path.join(root,'src/stage.js'),path.join(out,'assets/stage.js'));

/* ---- home ------------------------------------------------------------ */

// The gutter counts entries. A section with none is marked the way an editor
// marks the end of a buffer, and says so in words for anyone not reading glyphs.
const bufferRow = (slug, name, gloss, count) => {
  const collection = typeof count === 'number';
  const state = !collection ? 'page' : count ? 'filled' : 'empty';
  const mark = collection ? (count ? String(count) : '~') : '';
  const state_word = !collection ? '' : count ? `${count} published` : 'none yet';
  return `<a class="line" data-state="${state}" href="${href(`/${slug}/`)}"><span class="mark" aria-hidden="true">${mark}</span><span class="col"><span class="name">${name}</span><span class="gloss">${e(gloss)}</span><span class="state">${e(state_word)}</span></span></a>`;
};

// Once something is published, the newest investigation leads the page.
const newest = posts[0];
const latest = newest ? `<a class="entry" href="${href(`/archive/${newest.slug}/`)}"><span class="mark" aria-hidden="true">${e(newest.date.slice(2))}</span><span class="col"><h2>${e(newest.title)}</h2><p>${e(newest.description)}</p></span></a>` : '';

const home = `<div class="shell">${masthead('')}
<main id="main">
<section class="exhibit">
<div class="exhibit-head">
<h1>What a system claims, and what it actually does.</h1>
<p class="standfirst">The unresolved archive. Independent security research by Arun, on kernel internals, client software, and the questions that stay open.</p>
</div>
<div class="readout" data-readout hidden>
<p class="readout-lead">Your browser was not asked for any of this. It answered anyway.</p>
<dl data-readout-list></dl>
<p class="readout-id" data-readout-id></p>
<p class="readout-note">None of it left this device. This page's security policy forbids it from sending anything out.</p>
</div>
<div class="stage" data-stage aria-hidden="true" hidden><canvas></canvas></div>
</section>
${latest}<nav class="buffer" aria-label="Sections">
${bufferRow('archive','archive','long-form investigations', posts.length)}
${bufferRow('notes','notes','smaller findings and loose ends', notes.length)}
${bufferRow('methods','methods','how the work is done')}
${bufferRow('about','about','who is behind this')}
</nav>
<section class="rail standing"><div class="mark" aria-hidden="true"></div><div class="col">
<p>Writeups appear here once the vendor has shipped a fix, never before. The archive fills slowly and lags the work by months.</p>
<p>It also means nothing published here is speculation.</p>
</div></section>
</main>
${footer()}
</div>`;
await save('/', document({title:'The unresolved archive', description:'Independent security research by Arun. Kernel internals, client software, and the questions still open.', route:'/', content:home, home:true}));

/* ---- listings --------------------------------------------------------- */

function listing(records, kind) {
  return records.map(entry => `<a class="entry" href="${href(`/${kind}/${entry.slug}/`)}"><span class="mark" aria-hidden="true">${e(entry.date.slice(2))}</span><span class="col"><h2>${e(entry.title)}</h2><p>${e(entry.description)}</p>${entry.tags?.length ? `<span class="tags">${entry.tags.map(tag => `<span>${e(tag)}</span>`).join('')}</span>` : ''}</span></a>`).join('');
}

function nothing(text, linkText, linkHref) {
  return `<section class="rail nothing"><div class="mark" aria-hidden="true">~</div><div class="col"><p>${e(text)}</p><a class="plain" href="${linkHref}">${e(linkText)}</a></div></section>`;
}

await page('/archive/','archive','The archive','Investigations into kernels, clients, and the gap between documented and actual behaviour.',
  `${pagehead('The archive','Investigations into kernels, clients, and the gap between documented and actual behaviour.', `${posts.length} published`)}${posts.length ? listing(posts,'archive') : nothing('No investigation is published yet. The first one lands when the vendor it concerns has shipped its fix.','Read the research approach', href('/methods/'))}`);

await page('/notes/','notes','Field notes','Smaller findings, working observations, and questions that deserve another look.',
  `${pagehead('Field notes','Smaller findings, working observations, and questions that deserve another look.', `${notes.length} published`)}${notes.length ? listing(notes,'notes') : nothing('No notes yet. Shorter findings and loose ends will collect here alongside the longer investigations.','Visit the archive', href('/archive/'))}`);

/* ---- about and methods ------------------------------------------------ */

await page('/about/','about','About','Independent security research by Arun — what this archive is for and how it is kept.',
  `${pagehead('About','An archive kept by one researcher, for work that holds up after the fix has shipped.')}<section class="rail"><div class="mark" aria-hidden="true"></div><div class="col"><div class="prose">
<p>I work on vulnerability research full time, mostly alone, mostly by reading source. The work splits between kernel and platform internals, desktop and mobile clients, and the cloud and identity surfaces that sit behind them.</p>
<h2>Why the archive is slow</h2>
<p>A finding is worth writing up when the fix is public and the reasoning can be shown end to end. Until then it stays unpublished. That keeps this archive thin for long stretches, and it keeps everything in it checkable.</p>
<h2>What a writeup is for</h2>
<p>Each one should let somebody retrace the investigation: enough context to follow the reasoning, enough detail to reproduce the observation, and a clear line between what was established and what is still a hypothesis.</p>
<p><a href="https://github.com/arunmanni-ai" rel="noopener noreferrer">github.com/arunmanni-ai</a></p>
</div></div></section>`);

const methods = [
['Start from a claim.','Find where the system states what it will do — documentation, a comment, a check in the code — and treat that as the thing to be tested, not as fact.'],
['Make the observation reproducible.','Record environment, versions, inputs, and steps while the result is fresh. Keep the evidence next to the claim it supports.'],
['Separate what is shown from what is inferred.','State what the result establishes, which readings remain open, and where the investigation stops.'],
['Publish after the fix.','Work in authorised environments, disclose to the vendor first, and wait for the patch to ship before anything goes public.']
];
await page('/methods/','methods','Methods','How the research is done: claims tested, observations recorded, findings published after the fix ships.',
  `${pagehead('Methods','Four rules the archive is kept to. They are in order because the work is.')}${methods.map(([title,text],index)=>`<section class="step"><span class="mark" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><span class="col"><h2>${e(title)}</h2><p>${e(text)}</p></span></section>`).join('')}`);

/* ---- articles ---------------------------------------------------------- */

for (const [kind, records] of [['archive',posts],['notes',notes]]) {
  for (const entry of records) {
    const route = `/${kind}/${entry.slug}/`;
    paths.push(route);
    const headings = entry.blocks.filter(block => block.type === 'heading');
    const wordCount = entry.blocks.map(block => block.text || block.items?.join(' ') || '').join(' ').trim().split(/\s+/).length;
    const minutes = Math.max(1, Math.ceil(wordCount / 200));
    const stamp = `<time datetime="${e(entry.date)}">${e(entry.date)}</time> &nbsp; ${minutes} min read${entry.tags?.length ? ` &nbsp; ${entry.tags.map(e).join(' &nbsp; ')}` : ''}`;
    await page(route,kind,entry.title,entry.description,
      `${pagehead(entry.title, entry.description, stamp, `<a class="backlink" href="${href(`/${kind}/`)}">Back to ${kind === 'archive' ? 'the archive' : 'field notes'}</a>`)}<section class="rail"><div class="mark" aria-hidden="true"></div><div class="col"><div class="article"><article class="prose">${renderBlocks(entry.blocks,base)}</article>${headings.length ? `<nav class="contents" aria-label="On this page"><p>On this page</p>${headings.map(block=>`<a href="#${headingId(block.id)}">${e(block.text)}</a>`).join('')}</nav>` : ''}</div></div></section>`);
  }
}

await page('/404.html','','Not found','This path does not lead to a published page.',
  `${pagehead('Not found','This path has moved, or nothing has been published at it yet.')}<section class="rail"><div class="mark" aria-hidden="true">~</div><div class="col"><a class="plain" href="${href('/')}">Back to the archive</a></div></section>`, true);

await writeFile(path.join(out,'CNAME'),'arun0x.run\n');
await writeFile(path.join(out,'.nojekyll'),'');
await writeFile(path.join(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(route=>`<url><loc>${origin}${route}</loc></url>`).join('')}</urlset>\n`);
console.log(`Built ${paths.length} pages + 404. Investigations: ${posts.length}; notes: ${notes.length}. Base: ${base || '/'}.`);
