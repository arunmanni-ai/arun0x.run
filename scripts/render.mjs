export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function safeSlug(value) {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 100) throw new Error('Use a lowercase, hyphen-separated slug, up to 100 characters.');
  return value;
}
export function safeBase(value = '') {
  if (!/^\/(?:[a-zA-Z0-9_-]+\/?)*$/.test(value) && value !== '') throw new Error('Invalid SITE_BASE_PATH.');
  return value.replace(/\/$/, '');
}
export function safeHref(value, base = '') {
  if (typeof value !== 'string') throw new Error('Links must be strings.');
  if (value.startsWith('/') && !value.startsWith('//') && !/[\\\u0000-\u0020]/.test(value) && !/(^|\/)\.{1,2}(\/|$)/.test(value)) {
    const decoded = decodeURIComponent(value);
    if (/[\\\u0000-\u0020]/.test(decoded) || decoded.startsWith('//') || /(^|\/)\.{1,2}(\/|$)/.test(decoded)) throw new Error('Invalid local link.');
    return escapeHtml(base + value);
  }
  if (/^#[a-z0-9-]+$/.test(value)) return escapeHtml(value);
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('External links must use HTTPS and contain no credentials.');
  return escapeHtml(url.href);
}
export function renderBlocks(blocks, base = '') {
  if (!Array.isArray(blocks)) throw new Error('Content blocks must be an array.');
  const usedIds = new Set();
  return blocks.map(block => {
    if (!block || typeof block !== 'object') throw new Error('Invalid content block.');
    switch (block.type) {
      case 'paragraph': return `<p>${escapeHtml(block.text)}</p>`;
      case 'heading': {
        const id = safeSlug(block.id);
        if (usedIds.has(id)) throw new Error(`Duplicate heading: ${id}`);
        usedIds.add(id);
        return `<h2 id="${id}">${escapeHtml(block.text)}</h2>`;
      }
      case 'code': return `<div class="code-block"><div class="code-label"><span>${escapeHtml(block.language || 'text')}</span><button type="button" data-copy-code hidden aria-label="Copy code">Copy</button></div><pre><code>${escapeHtml(block.text)}</code></pre></div>`;
      case 'list': {
        if (!Array.isArray(block.items)) throw new Error('List items must be an array.');
        return `<ul>${block.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
      }
      case 'quote': return `<blockquote>${escapeHtml(block.text)}</blockquote>`;
      case 'link': return `<p><a href="${safeHref(block.href, base)}"${block.href.startsWith('https:') ? ' rel="noopener noreferrer"' : ''}>${escapeHtml(block.text)}</a></p>`;
      case 'image': {
        if (!/^\/assets\/[a-zA-Z0-9_/-]+\.(?:webp|png|jpg|jpeg)$/.test(block.src) || block.src.includes('..')) throw new Error('Images must be local raster assets.');
        if (typeof block.alt !== 'string' || !block.alt.trim()) throw new Error('Content images need descriptive alt text.');
        return `<figure><img src="${safeHref(block.src, base)}" alt="${escapeHtml(block.alt)}" loading="lazy" decoding="async">${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ''}</figure>`;
      }
      default: throw new Error(`Unsupported content block: ${block.type}`);
    }
  }).join('\n');
}
export function validateEntry(entry) {
  safeSlug(entry.slug);
  for (const field of ['title', 'description']) if (typeof entry[field] !== 'string' || !entry[field].trim()) throw new Error(`Missing ${field}.`);
  if (!['draft', 'published'].includes(entry.status)) throw new Error('Status must be draft or published.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || Number.isNaN(Date.parse(entry.date)) || new Date(entry.date).toISOString().slice(0, 10) !== entry.date) throw new Error('Use a valid YYYY-MM-DD date.');
  if (!Array.isArray(entry.blocks)) throw new Error('Missing content blocks.');
  if (entry.tags && (!Array.isArray(entry.tags) || entry.tags.some(tag => typeof tag !== 'string'))) throw new Error('Tags must be strings.');
  return entry;
}
