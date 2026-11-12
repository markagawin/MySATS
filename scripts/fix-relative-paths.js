// Expo's classic (non-router) web export always injects a few absolute
// root-relative paths (favicon link, main script src, and static asset
// references baked into the JS bundle). That's fine when hosting at a
// domain root, but breaks under a subpath host like GitHub Pages
// (https://user.github.io/RepoName/). This rewrites those specific,
// known references to relative paths after every `expo export -p web`.
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', process.argv[2] || 'dist');
// The hosting prefix — defaults to this repo's own GitHub Pages path, but a duplicate/backup
// copy hosted under a different repo name needs its own prefix passed as the 3rd argument
// (e.g. `node scripts/fix-relative-paths.js dist /MySATS-V2/`).
const basePath = process.argv[3] || '/MySATS/';

const indexPath = path.join(distDir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace('href="/favicon.ico"', 'href="favicon.ico"');
html = html.replace(/src="\/(_expo\/[^"]+)"/, 'src="$1"');
// The 404.html deep-link redirect restores the visible URL to e.g. /MySATS/History via
// history.replaceState before the deferred bundle <script> tag is parsed. Without an explicit
// <base>, the browser resolves that tag's relative src against the now-changed path
// (/MySATS/History/) instead of /MySATS/, 404ing the bundle. An explicit base pins it regardless.
html = html.replace('<head>', `<head>\n    <base href="${basePath}" />`);
fs.writeFileSync(indexPath, html);

const jsDir = path.join(distDir, '_expo', 'static', 'js', 'web');
const jsFiles = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'));
for (const file of jsFiles) {
  const jsPath = path.join(jsDir, file);
  let js = fs.readFileSync(jsPath, 'utf8');
  const before = js;
  js = js.split('"/assets/').join('"assets/');
  if (js !== before) {
    fs.writeFileSync(jsPath, js);
  }
}

console.log('Rewrote absolute paths to relative for subpath hosting.');
