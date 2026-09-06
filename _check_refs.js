const fs = require('fs');
function check(f) {
  const h = fs.readFileSync(f, 'utf8');
  const m = h.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) { console.log(f + ': 无 script'); return; }
  const js = m[1];
  const defs = new Set();
  for (const mm of js.matchAll(/(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\())/g)) {
    if (mm[1]) defs.add(mm[1]);
    if (mm[2]) defs.add(mm[2]);
  }
  const calls = new Set();
  for (const mm of js.matchAll(/(?:onclick|onchange|oninput|onkeydown)="([A-Za-z_$][\w$]*)/g)) calls.add(mm[1]);
  for (const mm of js.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) calls.add(mm[1]);
  const builtin = new Set(['if','for','while','switch','catch','function','return','typeof','new','require','async','await','document','window','localStorage','JSON','Object','Array','String','Number','Math','Date','Promise','console','fetch','alert','confirm','prompt','setTimeout','setInterval','clearTimeout','parseInt','parseFloat','encodeURIComponent','decodeURIComponent','location','LZString','supabase','SB','open','navigator','Blob','URL','FileReader','FormData','TextEncoder','TextDecoder','Error','Infinity','NaN','isNaN','isFinite','RegExp','Map','Set','Symbol','Proxy','Reflect','event','undefined','globalThis']);
  const missing = [...calls].filter(c => !defs.has(c) && !builtin.has(c));
  console.log(f + ': 未定义引用 ->', missing.length ? missing.join(', ') : '无');
}
for (const f of ['index.html', 'group.html', 'class.html']) check(f);
