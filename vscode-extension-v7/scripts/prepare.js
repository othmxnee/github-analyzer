#!/usr/bin/env node
/* Pull the shared pieces from the main project (run before packaging):
 *   webview/       <- frontend built in embed mode (the website's dashboard)
 *   engine-src/    <- backend Python sources (the website's engine), no .env
 *   engine-client.js <- shared/engine-client.js */
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ext = path.join(__dirname, '..');
const main = path.join(ext, '..');
const frontend = path.join(main, 'frontend');
const backend = path.join(main, 'backend');

execSync('npm run build:embed', { cwd: frontend, stdio: 'inherit' });
fs.rmSync(path.join(ext, 'webview'), { recursive: true, force: true });
fs.cpSync(path.join(frontend, 'dist-embed'), path.join(ext, 'webview'), { recursive: true });

const dst = path.join(ext, 'engine-src');
fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });
for (const f of ['app.py', 'extensions.py', 'bridge.py', 'requirements.txt']) {
  fs.copyFileSync(path.join(backend, f), path.join(dst, f));
}
for (const dir of ['routes', 'services', 'utils']) {
  fs.mkdirSync(path.join(dst, dir));
  for (const f of fs.readdirSync(path.join(backend, dir))) {
    if (f.endsWith('.py')) fs.copyFileSync(path.join(backend, dir, f), path.join(dst, dir, f));
  }
}
fs.copyFileSync(path.join(main, 'shared', 'engine-client.js'), path.join(ext, 'engine-client.js'));
console.log('prepared webview/, engine-src/ and engine-client.js');
