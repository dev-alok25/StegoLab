var StegoLab = window.StegoLab || {};
StegoLab.UI = StegoLab.UI || {};

StegoLab.UI.Dashboard = (() => {
  let currentTab = 'encode';
  const tabs = ['encode', 'decode'];

  function init() {
    const nav = document.querySelector('.tab-nav');
    if (!nav) return;

    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      const tab = btn.dataset.tab;
      if (tab && tabs.includes(tab)) {
        switchTab(tab);
      }
    });

    const saved = StegoLab.Storage.Settings.get('activeTab', 'encode');
    switchTab(saved);
  }

  function switchTab(tab) {
    if (!tabs.includes(tab)) return;
    currentTab = tab;

    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('tab-active', b.dataset.tab === tab);
    });

    document.querySelectorAll('.tab-panel').forEach(p => {
      const isActive = p.id === `tab-${tab}` || p.dataset.tab === tab;
      p.classList.toggle('panel-active', isActive);
    });

    StegoLab.Storage.Settings.set('activeTab', tab);

    const event = new CustomEvent('tabchange', { detail: { tab } });
    document.dispatchEvent(event);
  }

  function getCurrentTab() {
    return currentTab;
  }

  function getTabs() {
    return [...tabs];
  }

  return { init, switchTab, getCurrentTab, getTabs };
})();
