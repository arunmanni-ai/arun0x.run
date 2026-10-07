const toggle = document.querySelector('.reading-toggle input[type="checkbox"]');
if (toggle) {
  const art = document.querySelector('#visual-view');
  const reading = document.querySelector('#text-view');
  function applyReadingView(enabled) {
    art.hidden = enabled;
    reading.hidden = !enabled;
    document.body.classList.toggle('reading-mode', enabled);
    toggle.checked = enabled;
  }
  try { applyReadingView(localStorage.getItem('arun0x-reading') === 'true'); } catch { /* The view still works when storage is unavailable. */ }
  toggle.closest('label').hidden = false;
  toggle.addEventListener('change', () => {
    applyReadingView(toggle.checked);
    try { localStorage.setItem('arun0x-reading', String(toggle.checked)); } catch { /* Saving the preference is optional. */ }
  });
}
for (const button of document.querySelectorAll('[data-copy-code]')) {
  if (!navigator.clipboard || !window.isSecureContext) continue;
  button.hidden = false;
  button.addEventListener('click', async () => {
    const code = button.closest('.code-block').querySelector('code');
    try {
      await navigator.clipboard.writeText(code.textContent);
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = 'Copy'; }, 1800);
    } catch {
      button.textContent = 'Select to copy';
      setTimeout(() => { button.textContent = 'Copy'; }, 1800);
    }
  });
}
