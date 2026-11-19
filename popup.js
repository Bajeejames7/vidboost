const DEF = { enabled: true, buffer: 180, cap: 0, hud: true, startLow: false };
const $ = id => document.getElementById(id);
const label = v => (v >= 60 ? (v / 60) + ' min' : v + ' s');
chrome.storage.sync.get(DEF, s => {
  $('enabled').checked = s.enabled;
  $('buffer').value = s.buffer; $('bv').textContent = label(s.buffer);
  $('cap').value = s.cap;
  $('startLow').checked = s.startLow;
  $('hud').checked = s.hud;
});
const save = () => chrome.storage.sync.set({
  enabled: $('enabled').checked, buffer: +$('buffer').value, cap: +$('cap').value,
  startLow: $('startLow').checked, hud: $('hud').checked
});
['enabled', 'cap', 'startLow', 'hud'].forEach(id => { $(id).onchange = save; });
$('buffer').oninput = () => { $('bv').textContent = label(+$('buffer').value); save(); };
