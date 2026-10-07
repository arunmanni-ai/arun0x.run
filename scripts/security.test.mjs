import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat, mkdtemp, cp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, safeSlug, safeBase, safeHref, renderBlocks, validateEntry } from './render.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));

test('content is escaped, including code, title-shaped strings, and quotes', () => {
  const attack = '<script>alert("x")</script>&\'"';
  assert.equal(escapeHtml(attack), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;&quot;');
  for (const type of ['paragraph','quote','code']) {
    const rendered = renderBlocks([{type,text:attack}]);
    assert.ok(!rendered.includes('<script>'));
    assert.ok(rendered.includes('&lt;script&gt;'));
  }
});
test('content cannot insert active markup or unsafe link protocols', () => {
  assert.throws(()=>renderBlocks([{type:'html',text:'<iframe></iframe>'}]));
  for (const href of ['javascript:alert(1)','data:text/html,<script>x</script>','http://example.com','https://user:secret@example.com','//evil.test','/../secret','/%2e%2e/secret','/assets%5csecret','/\nsecret']) assert.throws(()=>safeHref(href));
  assert.equal(safeHref('https://example.com/?a=1&b=2'),'https://example.com/?a=1&amp;b=2');
  assert.equal(safeHref('/archive/','/project'),'/project/archive/');
});
test('slugs, base paths, duplicate headings, and image paths are validated', () => {
  for (const slug of ['../escape','hello/world','<script>','', 'UPPER']) assert.throws(()=>safeSlug(slug));
  assert.equal(safeSlug('kernel-investigation-01'),'kernel-investigation-01');
  assert.throws(()=>safeBase('//evil.test'));
  assert.throws(()=>renderBlocks([{type:'heading',id:'one',text:'A'},{type:'heading',id:'one',text:'B'}]));
  assert.throws(()=>renderBlocks([{type:'image',src:'/assets/payload.svg',alt:'image'}]));
  assert.throws(()=>renderBlocks([{type:'image',src:'/assets/example.png',alt:''}]));
});
test('entries reject invalid dates and accidental publishing status', () => {
  const entry = {slug:'sample',title:'Sample',description:'Example',date:'2026-10-07',status:'draft',blocks:[]};
  assert.equal(validateEntry(entry),entry);
  assert.throws(()=>validateEntry({...entry,status:'ready'}));
  assert.throws(()=>validateEntry({...entry,date:'2026-02-30'}));
});
async function walk(dir) {
  let files = [];
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const full = path.join(dir,entry.name);
    files = files.concat(entry.isDirectory() ? await walk(full) : full);
  }
  return files;
}
test('complete build excludes drafts and resolves local links and assets', async () => {
  execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root});
  const docs = path.join(root,'docs');
  const files = await walk(docs);
  let publishedCount = 0;
  for (const [folder, route] of [['posts','archive'],['notes','notes']]) {
    const contentDir = path.join(root,'content',folder);
    for (const name of (await readdir(contentDir)).filter(name=>name.endsWith('.json'))) {
      const entry = JSON.parse(await readFile(path.join(contentDir,name),'utf8'));
      if (entry.status === 'published') publishedCount++;
      else assert.ok(!files.includes(path.join(docs,route,entry.slug,'index.html')));
    }
  }
  const html = files.filter(file=>file.endsWith('.html'));
  assert.equal(html.length,6 + publishedCount);
  for (const file of html) {
    const text = await readFile(file,'utf8');
    assert.ok(text.includes('Content-Security-Policy'));
    assert.ok(text.includes('Skip to content'));
    assert.ok(!/<script(?![^>]*src=)/.test(text));
    for (const match of text.matchAll(/(?:href|src)="(\/[^"#]*)"/g)) {
      const relative = decodeURIComponent(match[1]);
      let target = path.join(docs,relative);
      if (relative.endsWith('/')) target = path.join(target,'index.html');
      assert.ok((await stat(target)).isFile(), `${path.basename(file)} links to missing ${relative}`);
    }
  }
  assert.equal((await readFile(path.join(docs,'CNAME'),'utf8')).trim(),'arun0x.run');
});

test('published articles build safely with a project base path and contents navigation', async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(),'arun0x-content-'));
  try {
    for (const dir of ['scripts','src','content']) await cp(path.join(root,dir),path.join(sandbox,dir),{recursive:true});
    const attack = '<script>alert(1)</script>';
    await writeFile(path.join(sandbox,'content/posts/test.json'),JSON.stringify({
      slug:'security-check', title:attack, description:attack, date:'2026-10-07', status:'published',
      blocks:[{type:'heading',id:'evidence',text:'Evidence'},{type:'paragraph',text:attack},{type:'code',language:'html',text:attack}]
    }));
    execFileSync(process.execPath,['scripts/build.mjs'],{cwd:sandbox,env:{...process.env,SITE_BASE_PATH:'/arun0x.run'}});
    const article = await readFile(path.join(sandbox,'docs/archive/security-check/index.html'),'utf8');
    assert.ok(!article.includes('<script>alert'));
    assert.ok(article.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(article.includes('href="#evidence"'));
    assert.ok(article.includes('href="/arun0x.run/assets/styles.css"'));
    const home = await readFile(path.join(sandbox,'docs/index.html'),'utf8');
    assert.ok(home.includes('href="/arun0x.run/archive/security-check/"'));
    assert.ok(!article.includes('/first-investigation/'));
  } finally { await rm(sandbox,{recursive:true,force:true}); }
});
