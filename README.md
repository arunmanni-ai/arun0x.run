# arun0x.run

Arun's independent security research archive.

The layout is built on one structural idea: a gutter down the left of every page carries state, and the content column carries the work. The gutter holds entry counts on the homepage, dates on listings and articles, and step numbers on Methods. A section with nothing in it is marked the way an editor marks the end of a buffer.

The homepage opens on an exhibit: a 3D stack of plates drawn on a canvas, beside a readout of what the visitor's browser disclosed without being asked (browser, system, screen, cores, GPU, time zone, languages, battery, canvas rendering and so on). Each answer cuts one plate, so every visitor sees a different object, and hovering a row lights its plate. All of it is read locally by `src/stage.js`; nothing is stored or sent, there is no IP or location lookup, and the page's content policy (`connect-src 'none'`) would block a request anyway. Without JavaScript the exhibit is simply absent.

Typography splits along the same line. A serif carries anything written for a person to read — headlines, ledes, prose. A monospace carries anything the machine supplies: identifiers, counts, dates, tags, code. Titles are sentence case, identifiers are lowercase.

## Local preview

Requires Node.js 20 or newer. No packages need installing.

```sh
npm run build
npm run preview
```

Open http://127.0.0.1:4173. `PORT=4174 npm run preview` selects a different port. The preview server listens only on your own computer. Stop with Ctrl+C.

`npm test` checks content escaping across all block types, unsafe links, invalid paths, draft exclusion, generated links/assets, heading ID isolation, client-script injection sinks, and unintended asset publication.

## Publish a writeup or note

1. Copy the example in `content/posts/first-investigation.json` or `content/notes/first-note.json` to a new `.json` file.
2. Give it a unique `slug`, title, short description, date, and tags.
3. Write the content blocks. Keep `"status": "draft"` while preparing it.
4. Set `"status": "published"` when ready and push to `main`.

The workflow builds and publishes the site automatically. The newest published investigation becomes the featured homepage item. Drafts are excluded from the **website**, but all files committed to this **public repository** remain visible on GitHub. Keep sensitive research and private drafts outside the repository.

Supported blocks:

```json
[
  { "type": "heading", "id": "overview", "text": "Overview" },
  { "type": "paragraph", "text": "Your research, in your words." },
  { "type": "code", "language": "c", "text": "int main(void) { return 0; }" },
  { "type": "list", "items": ["First observation", "Second observation"] },
  { "type": "quote", "text": "A useful excerpt, with appropriate attribution." },
  { "type": "link", "href": "https://example.org/reference", "text": "Reference" },
  { "type": "image", "src": "/assets/example.webp", "alt": "Describe the evidence shown", "caption": "Optional caption" }
]
```

Use `\n` inside a JSON string to represent a line break in a code block. Images go in `src/assets/`; the builder accepts WebP, PNG, JPG, and JPEG files with simple names (letters, digits, underscores, and hyphens). It rejects hidden files, symbolic links, and other file types; the reviewed `favicon.svg` is the sole SVG exception. Content is rendered at build time and works without JavaScript. No raw HTML content blocks are accepted. Headings create an article contents list with `section-` prefixed anchors (for example, `#section-overview`), and code blocks have a copy button when the browser supports it.

## GitHub Pages and arun0x.run

The supplied workflow publishes only `docs/`, never source, scripts, or draft content. All third-party Actions are pinned to verified commit IDs. The workflow uses the Node.js already provided by the Ubuntu 24.04 runner and has no package installation step.

In the repository's **Settings → Pages**, choose **GitHub Actions** as the publishing source. The site also includes a prebuilt `docs/` folder and `.nojekyll` if you prefer a branch-based Pages deployment from `main /docs` instead; disable the Actions workflow before switching to branch deployment.

For the custom domain:

1. In your **GitHub account Settings → Pages**, verify `arun0x.run` using the TXT record GitHub gives you. Keep that verification record.
2. In **repository Settings → Pages → Custom domain**, enter `arun0x.run`.
3. At your domain registrar, configure these apex A records (name `@`):

| Type | Name | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | arunmanni-ai.github.io |

Remove conflicting parked-domain records for these names; preserve unrelated email and verification records. Do not use wildcard DNS records. After DNS is ready and GitHub has issued a certificate, enable **Enforce HTTPS** in repository Pages settings. GitHub notes DNS can take up to 24 hours to propagate.

The `CNAME` file supports branch publishing. With the included Actions workflow, GitHub ignores that file: the custom domain **must** be configured in repository Pages settings. The build automatically respects the Pages base path for a temporary `github.io/arun0x.run/` address.

Official guidance: [custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [domain verification](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages), [HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

## Design and behavior

- Home, archive, notes, about, methods, and a custom 404 page.
- Empty states state the publishing rule rather than apologise for being empty. No invented discoveries or placeholder posts.
- The homepage leads with the newest published investigation as soon as one exists; until then the section index carries the page.
- Entry counts in the gutter are generated from published content, so the homepage cannot claim work that is not there.
- Keyboard navigation, visible focus, a skip link, reduced-motion support, and print styling that drops the rail and prints on white.
- System fonts only. No external runtime requests, webfonts, trackers, cookies, analytics, or forms.
- Canonical URLs and sitemap point to `https://arun0x.run`.

The text on About and Methods is proposed editorial copy based on the direction of the reference. Review it before your first writeup to make sure it reflects your own approach.

## Security boundaries

This is static content, with no database, authentication, secret keys, or server-side execution. All author-controlled content is escaped; unknown block types, unsafe links, nonlocal images, invalid dates, and unsafe slugs fail the build. JavaScript does two things: `site.js` copies a code block to the clipboard, and `stage.js` draws the homepage exhibit from values the browser exposes. Neither injects HTML, touches storage, or makes network requests, and a test asserts those sinks stay absent from both files.

A restrictive CSP is delivered in every HTML page through a meta element. GitHub Pages does not let this project set arbitrary response headers: meta CSP cannot enforce `frame-ancestors`, and this project does not claim to set HSTS, Permissions-Policy, or other hosting-level controls. HTTPS enforcement is a GitHub Pages setting. No website can be guaranteed immune to every attack; the implementation deliberately limits the parts that can accept or execute data.

## Artwork

The site no longer uses a background image. `src/assets/archive.webp` and `archive-small.webp` are kept in the repository so the earlier homepage can be restored, and their provenance is recorded in `ARTWORK.md`. They are still copied into `docs/assets/`; delete both files if you want them out of the deploy.

No image generation occurs on the website.
