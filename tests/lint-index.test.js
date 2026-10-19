// The entity index (game/js/index.js) stays in step with W.list only if owners change through idxSetOwner and
// W.list changes only in addEnt and removeEnt. This lint fails on any other entity owner write or W.list mutation in
// game/js. The allow-list is exact: each listed file must contain exactly that many matches, so a new write in an
// allowed file fails too, and so does an entry that no longer matches.   node tests/lint-index.test.js
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'game', 'js');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
const RULES = [
  {
    name: 'entity owner writes go through idxSetOwner (index.js)',
    re: /\.owner\s*(?:[-+*|&]|\?\?|\|\||&&)?=(?!=)/g,
    allow: {
      'index.js': { count: 3, why: 'idxSetOwner and idxSync: the index record (r.owner) and the entity (e.owner)' },
      'editor.js': { count: 2, why: 'this.owner: the editor brush\'s chosen player, not an entity' },
    },
  },
  {
    name: 'W.list changes only in addEnt and removeEnt (world.js)',
    re: /\bW\.list\s*(?:=(?!=)|\.length\s*=(?!=)|\.(?:push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin)\s*\()/g,
    allow: {
      'world.js': { count: 2, why: 'addEnt pushes, removeEnt splices' },
      'victory.js': { count: 3, why: 'vicWithGhosts appends fog-memory ghosts for one frame and takes them off again (push, length =, splice)' },
    },
  },
  {
    name: 'W.list is not kept under another name (an alias could be mutated unseen)',
    re: /(?:\b(?:const|let|var)\s+[\w$]+|[\w$.\]]+)\s*=\s*W\.list\s*[;,)]/g,
    allow: {
      'index.js': { count: 1, why: 'IDX.list = W.list: the index remembers which list it describes' },
    },
  },
];
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort();
for (const rule of RULES) {
  const found = {}, bad = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    src.split(/\r?\n/).forEach((line, i) => { const m = line.match(rule.re); if (m) { found[f] = (found[f] || 0) + m.length; if (!rule.allow[f]) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`); } });
  }
  const counts = Object.entries(rule.allow).filter(([f, a]) => (found[f] || 0) !== a.count).map(([f, a]) => `${f}: ${found[f] || 0} found, ${a.count} allowed`);
  ok(rule.name, !bad.length && !counts.length, bad.length || counts.length ? { outside: bad, counts } : found);
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
