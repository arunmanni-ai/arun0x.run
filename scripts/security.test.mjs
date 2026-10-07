import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat, mkdtemp, cp, writeFile, rm, symlink } from 'node:fs/promises';
import vm from 'node:vm';
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
  for (const href of ['javascript:alert(1)','JaVaScRiPt:alert(1)','java\nscript:alert(1)','javascript&#58;alert(1)','data:text/html,<script>x</script>','http://example.com','https://user:secret@example.com','//evil.test','/../secret','/%2e%2e/secret','/assets%5csecret','/%2f%2fevil.test','/x/%2e%2e/secret','/%00test','/%0d%0atest','/\nsecret']) assert.throws(()=>safeHref(href));
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
      const relative = decodeURIComponent(new URL(match[1], 'https://arun0x.run').pathname);
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
    assert.ok(article.includes('href="#section-evidence"'));
    assert.ok(article.includes('id="section-evidence"'));
    assert.match(article, /href="\/arun0x\.run\/assets\/styles\.css\?v=[a-f0-9]{12}"/);
    const home = await readFile(path.join(sandbox,'docs/index.html'),'utf8');
    assert.ok(home.includes('href="/arun0x.run/archive/security-check/"'));
    assert.ok(!article.includes('/first-investigation/'));
  } finally { await rm(sandbox,{recursive:true,force:true}); }
});

test('injection payloads remain text in every supported content context', () => {
  for (const attack of ['<svg/onload=alert(1)>','"><img src=x onerror=alert(1)>',"' autofocus onfocus='alert(1)",'</title><script>alert(1)</script>','</code></pre><iframe srcdoc="<script>alert(1)</script>">']) {
    for (const block of [
      {type:'paragraph',text:attack}, {type:'quote',text:attack},
      {type:'heading',id:'main',text:attack}, {type:'code',text:attack,language:attack},
      {type:'list',items:[attack]}, {type:'link',text:attack,href:'https://example.org/'},
      {type:'image',src:'/assets/archive.webp',alt:attack,caption:attack}
    ]) {
      const html = renderBlocks([block]);
      assert.ok(html.includes(escapeHtml(attack)));
      assert.ok(!html.includes(attack));
      assert.ok(!/<(?:script|iframe|svg)\b/.test(html));
    }
  }
});

test('article headings cannot collide with interface IDs', () => {
  const html = renderBlocks(['main','reading-view','visual-view','text-view'].map(id=>({type:'heading',id,text:id})));
  for (const id of ['main','reading-view','visual-view','text-view']) {
    assert.ok(html.includes(`id="section-${id}"`));
    assert.ok(!html.includes(`id="${id}"`));
  }
});

test('reading view tolerates blocked or untrusted storage and repeated switching', async () => {
  const source = await readFile(path.join(root,'src/site.js'),'utf8');
  for (const stored of ['true','false','<svg/onload=alert(1)>',null,'blocked']) {
    let listener;
    let enabled = false;
    const label = {hidden:true};
    const toggle = {checked:false,closest:()=>label,addEventListener:(event,fn)=>{assert.equal(event,'change');listener=fn;}};
    const art = {hidden:false};
    const reading = {hidden:true};
    const writes = [];
    vm.runInNewContext(source, {
      document:{
        querySelector:selector=>selector.includes('input') ? toggle : selector === '#visual-view' ? art : selector === '#text-view' ? reading : null,
        querySelectorAll:()=>[],
        body:{classList:{toggle:(name,value)=>{assert.equal(name,'reading-mode');enabled=value;}}}
      },
      localStorage:{getItem:()=>{if(stored==='blocked')throw new Error('Storage denied');return stored;},setItem:(key,value)=>{if(stored==='blocked')throw new Error('Storage denied');writes.push([key,value]);}}
    });
    assert.equal(enabled,stored==='true');
    assert.equal(label.hidden,false);
    for (const value of [true,false,true,false]) {
      toggle.checked=value;
      listener();
      assert.equal(enabled,value);
      assert.equal(art.hidden,value);
      assert.equal(reading.hidden,!value);
    }
    assert.equal(writes.length,stored==='blocked' ? 0 : 4);
  }
  // An article may contain a heading with this name but no homepage controls.
  vm.runInNewContext(source, {document:{querySelector:selector=>selector==='#reading-view' ? {tagName:'H2'} : null,querySelectorAll:()=>[]}});
});

test('the build refuses accidental files, active assets, and symbolic links', async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(),'arun0x-assets-'));
  try {
    for (const dir of ['scripts','src','content']) await cp(path.join(root,dir),path.join(sandbox,dir),{recursive:true});
    for (const name of ['.env','payload.html','payload.js','payload.svg','notes.json']) {
      const file = path.join(sandbox,'src/assets',name);
      await writeFile(file,'This file must not ship.');
      assert.throws(()=>execFileSync(process.execPath,['scripts/build.mjs'],{cwd:sandbox,stdio:'pipe'}));
      await rm(file);
    }
    await writeFile(path.join(sandbox,'private.txt'),'Private fixture');
    await symlink(path.join(sandbox,'private.txt'),path.join(sandbox,'src/assets/leak.png'));
    assert.throws(()=>execFileSync(process.execPath,['scripts/build.mjs'],{cwd:sandbox,stdio:'pipe'}));
  } finally { await rm(sandbox,{recursive:true,force:true}); }
});
