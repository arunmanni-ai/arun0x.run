# Connect arun0x.run from Spaceship

The site is deployed through GitHub Pages with `arun0x.run` configured as its custom domain.

Setup completed in Spaceship: four GitHub Pages A records at `@`, plus `www` pointing to `arunmanni-ai.github.io`. Public DNS resolution confirms all five records. The domain serves the archive and `www` redirects to the apex. No products were purchased. The instructions below are kept for reference and recovery. Account-level domain verification remains a recommended additional step.

## 1. Verify ownership in GitHub

Open https://github.com/settings/pages, add `arun0x.run`, and copy the TXT record GitHub provides. In Spaceship's **Advanced DNS Manager → arun0x.run → DNS records → Custom records**, add that TXT record, then finish verification in GitHub. Keep the TXT record after verification.

GitHub recommends this verification before connecting a custom domain to reduce the risk of someone else claiming the domain for their Pages site. The TXT value is account-specific; this project cannot invent it.

## 2. Set the repository custom domain

Open https://github.com/arunmanni-ai/arun0x.run/settings/pages.

Under **Custom domain**, enter `arun0x.run` and save. Do this before changing the destination records. This reserves the domain for this site. With Actions publishing, the repository's `CNAME` file does not configure this setting automatically.

## 3. Add the Spaceship destination records

Open **Advanced DNS Manager → arun0x.run → DNS records → Custom records**. Add:

| Type | Host | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | arunmanni-ai.github.io |

Use the default TTL. Remove the existing parking A records at `@` and any conflicting record at `www`. If Spaceship has a managed parking or forwarding product that owns the existing records, disable that parking/forwarding for these names. Preserve other records, including email and the GitHub verification TXT record. Do not add wildcard records.

Spaceship also supports an apex CNAME that resolves as an ALIAS, but the four explicit A records above follow GitHub's documented configuration and are the setup used here.

## 4. Finish HTTPS

Once the repository's DNS check passes and the certificate is ready, enable **Enforce HTTPS** in GitHub Pages settings. DNS changes may take up to 24 hours according to GitHub. Check both https://arun0x.run and https://www.arun0x.run; `www` should redirect to the apex domain.

After this, push an update or rerun **Publish research archive** in the repository's Actions tab. The workflow will use the new domain's root base path rather than `/arun0x.run/`.

## Sources

- [Spaceship: adding DNS records](https://www.spaceship.com/knowledgebase/dns-records-types/)
- [GitHub: verify domain ownership](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
- [GitHub: custom domains and record values](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub: HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
