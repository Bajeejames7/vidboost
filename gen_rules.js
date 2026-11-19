// node gen_rules.js -> rules.json (ad / popunder networks common on free-stream embeds)
const domains = ['doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com',
  'popads.net', 'popcash.net', 'propellerads.com', 'onclickads.net', 'exoclick.com', 'exosrv.com', 'juicyads.com',
  'adcash.com', 'a-ads.com', 'hilltopads.net', 'clickadu.com', 'adsterra.com', 'highperformanceformat.com',
  'profitablegatecpm.com', 'trafficjunky.net', 'mgid.com', 'taboola.com', 'outbrain.com', 'revcontent.com',
  'adnxs.com', 'criteo.com', 'pubmatic.com', 'rubiconproject.com', 'amazon-adsystem.com', 'bidgear.com', 'histats.com'];
const rules = domains.map((d, i) => ({
  id: i + 1, priority: 1, action: { type: 'block' },
  condition: { requestDomains: [d], resourceTypes: ['script', 'sub_frame', 'xmlhttprequest', 'image', 'ping', 'media', 'other'] }
}));
require('fs').writeFileSync(__dirname + '/rules.json', JSON.stringify(rules, null, 1));
console.log(rules.length + ' rules');
