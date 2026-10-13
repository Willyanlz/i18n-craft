try {
  if (localStorage.getItem('i18ncraft.theme') === 'dark') {
    document.documentElement.dataset.theme = 'dark';
  }
} catch {
  // The default theme remains usable when storage is unavailable.
}
