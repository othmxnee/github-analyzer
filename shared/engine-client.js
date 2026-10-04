'use strict';
/*
 * Client for the analysis engine bridge (backend/bridge.py), shared by the
 * desktop app and the VS Code extension. Canonical copy:
 * github-analyzer/shared/engine-client.js (the clients' build scripts copy it).
 *
 * One long-lived engine process; requests are JSON lines matched to replies
 * by id. If the process dies, pending requests fail and the next request
 * starts a fresh process.
 */
const { spawn } = require('child_process');
const readline = require('readline');

class EngineClient {
  /**
   * @param {object} opts
   * @param {() => {cmd: string, args: string[]}} opts.resolve  how to launch the engine
   * @param {object} [opts.env]        extra environment variables
   * @param {(line: string) => void} [opts.log]  receives engine stderr lines
   * @param {number} [opts.timeoutMs]  per-request timeout
   */
  constructor({ resolve, env = {}, log = () => {}, timeoutMs = 15 * 60 * 1000 }) {
    this.resolveCmd = resolve;
    this.env = env;
    this.log = log;
    this.timeoutMs = timeoutMs;
    this.proc = null;
    this.ready = null;
    this.info = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  start() {
    if (this.ready) return this.ready;
    const { cmd, args } = this.resolveCmd();
    this.log(`[engine] starting: ${cmd} ${args.join(' ')}`);
    const proc = spawn(cmd, args, {
      env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8', ...this.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.proc = proc;
    this.ready = new Promise((resolve, reject) => {
      let settled = false;
      const fail = (err) => {
        if (!settled) { settled = true; reject(err); }
      };
      proc.on('error', (err) => { this.log(`[engine] spawn error: ${err.message}`); fail(err); this._reset(err); });
      proc.on('exit', (code, signal) => {
        this.log(`[engine] exited (code ${code}, signal ${signal})`);
        fail(new Error(`Analysis engine exited before it was ready (code ${code}).`));
        this._reset(new Error('The analysis engine stopped unexpectedly. Try again.'));
      });
      readline.createInterface({ input: proc.stderr }).on('line', (l) => this.log(l));
      readline.createInterface({ input: proc.stdout }).on('line', (line) => {
        let msg;
        try { msg = JSON.parse(line); } catch { return; }
        if (msg.event === 'ready') {
          this.info = msg;
          if (!settled) { settled = true; resolve(msg); }
          return;
        }
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        clearTimeout(p.timer);
        p.resolve(msg);
      });
    });
    return this.ready;
  }

  _reset(err) {
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(err); }
    this.pending.clear();
    this.proc = null;
    this.ready = null;
  }

  async request(msg) {
    await this.start();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('The analysis engine did not answer in time.'));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.proc.stdin.write(JSON.stringify({ ...msg, id }) + '\n');
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  /** Forward a page request ({method, path, query, body}) -> {status, body}. */
  async call({ method, path, query, body }) {
    const res = await this.request({ method, path, query, body });
    return { status: res.status, body: res.body };
  }

  stop() {
    const proc = this.proc;
    if (!proc) return;
    try { proc.stdin.write(JSON.stringify({ op: 'shutdown' }) + '\n'); } catch { /* ignore */ }
    setTimeout(() => { try { proc.kill(); } catch { /* ignore */ } }, 1500).unref?.();
    this._reset(new Error('Engine stopped.'));
  }
}

/**
 * Absolute path of a file named in the dashboard, or null. The engine's
 * ownership lists use normalised keys (a leading "./" or "src/" removed),
 * so try the path as given, then under src/, then any tracked file ending
 * with it.
 */
function resolveRepoFile(repoPath, file) {
  const fs = require('fs');
  const path = require('path');
  if (!repoPath || !file) return null;
  const rel = String(file).replace(/^\.\//, '');
  const root = path.resolve(repoPath);
  for (const candidate of [rel, path.join('src', rel)]) {
    const abs = path.resolve(root, candidate);
    if (abs.startsWith(root + path.sep) && fs.existsSync(abs)) return abs;
  }
  try {
    const out = require('child_process').execFileSync('git', ['-C', root, 'ls-files', '-z'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const hit = out.split('\0').find(f => f === rel || f.endsWith('/' + rel));
    if (hit) return path.join(root, hit);
  } catch { /* not a git checkout */ }
  return null;
}

module.exports = { EngineClient, resolveRepoFile };
