import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const preview = path.resolve(fileURLToPath(new URL('../../.preview/', import.meta.url)));

export function createChromeProfile(output) {
  if (path.resolve(output) !== preview) throw Error('Run browser checks from the project root');
  mkdirSync(preview, { recursive: true });
  return mkdtempSync(path.join(preview, 'chrome-'));
}

export async function cleanupChrome(browser, profile) {
  if (browser.exitCode === null && browser.signalCode === null) {
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 5000);
      browser.once('exit', () => { clearTimeout(timer); resolve(); });
      browser.kill();
    });
  }
  try {
    // Resolve both paths before recursive removal, and only remove a generated
    // profile directly inside this workspace's QA directory. Never a user profile.
    const target = realpathSync(profile), base = realpathSync(preview);
    if (path.dirname(target) !== base || !path.basename(target).startsWith('chrome-')) {
      throw Error('Unsafe QA profile cleanup path: ' + profile);
    }
    await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
