// Isolated world: syncs settings from chrome.storage into the page (data attribute) and back.
const DEF = { enabled: true, buffer: 180, cap: 0, hud: true, startLow: false };
function push(s) {
  if (document.documentElement) document.documentElement.setAttribute('data-vidboost', JSON.stringify(s));
  window.postMessage({ __vb: 'cfg' }, '*');
}
chrome.storage.sync.get(DEF, push);
chrome.storage.onChanged.addListener(() => chrome.storage.sync.get(DEF, push));
window.addEventListener('message', e => {
  if (e.source === window && e.data && e.data.__vb === 'set') chrome.storage.sync.set(e.data.patch);
});
