// Commit these files so the optional renderer needs no CDN or build step to play.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), source = path.join(root, 'node_modules/three'), out = path.join(root, 'game/vendor/three');
fs.mkdirSync(out, { recursive: true });
for (const file of ['three.module.js', 'three.core.js']) fs.copyFileSync(path.join(source, 'build', file), path.join(out, file));
fs.copyFileSync(path.join(source, 'LICENSE'), path.join(out, 'LICENSE'));
const pkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
fs.writeFileSync(path.join(out, 'README.md'), `Three.js ${pkg.version}, MIT licensed.\n\nVendored from the pinned npm development dependency. Run \`npm run vendor:three\` after updating it.\n`);
console.log('Vendored Three.js ' + pkg.version);
