(() => {
  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  const menu = document.getElementById('theme-menu');
  const options = [...menu.querySelectorAll('[data-theme]')];
  const validThemes = new Set(options.map(option => option.dataset.theme));

  function applyTheme(theme) {
    const selectedTheme = validThemes.has(theme) ? theme : 'light';
    if (selectedTheme === 'light') delete root.dataset.theme;
    else root.dataset.theme = selectedTheme;
    localStorage.setItem('instant-ledger-theme', selectedTheme);
    options.forEach(option => {
      const selected = option.dataset.theme === selectedTheme;
      option.classList.toggle('active', selected);
      option.setAttribute('aria-pressed', String(selected));
    });
  }

  function closeMenu() {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  }

  applyTheme(localStorage.getItem('instant-ledger-theme') || 'light');
  toggle.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  });
  options.forEach(option => option.addEventListener('click', () => {
    applyTheme(option.dataset.theme);
    closeMenu();
  }));
  document.addEventListener('click', event => {
    if (!menu.hidden && !menu.contains(event.target) && !toggle.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) {
      closeMenu();
      toggle.focus();
    }
  });
})();
