// In-app updates: compare the installed version with the latest GitHub release, and ask
// TizenBrew Installer's local service on the TV to install it (the same request its own UI
// sends after the user types the repo name).
//
// The service protocol is not a documented API; it mirrors reisxd/TizenBrewInstaller
// (client/services/tizenbrew-installer-service). If it changes, updating fails with an
// error and users fall back to installing from TizenBrew Installer manually.
import { requestJson } from './http.js';

export const REPO = 'flyingluscas/tizarr';
const LATEST_RELEASE_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

const INSTALLER_SERVICE_ID = 'xvvl3S1bTI.InstallerService';
const INSTALLER_URL = 'ws://localhost:8091';
const EVENT = { INSTALL: 1, ERROR: 3, STATUS: 4 };
// After launching the service, keep trying to connect for a while (it takes a few seconds),
// then give it a moment to check developer mode before it accepts installs.
const SERVICE_START_TIMEOUT_MS = 10000;
const CONNECT_RETRY_MS = 1000;
const SERVICE_SETTLE_MS = 2000;
// The service stays silent if a precondition fails, so don't wait forever.
const INSTALL_TIMEOUT_MS = 3 * 60 * 1000;

/** "v0.4.2" or "0.4.2" → [0, 4, 2] */
export function parseVersion(version) {
  return String(version || '')
    .replace(/^v/, '')
    .split('.')
    .map((part) => parseInt(part, 10) || 0);
}

export function isNewer(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

/** Installed version on the TV, or null in a desktop browser (dev preview). */
export function installedVersion() {
  return window.tizen ? tizen.application.getCurrentApplication().appInfo.version : null;
}

export async function latestVersion() {
  const release = await requestJson('GET', LATEST_RELEASE_URL);
  return release.tag_name.replace(/^v/, '');
}

/**
 * Turns a service message into { kind: 'status' | 'error' | 'done', text }, or null for
 * messages we don't care about.
 */
export function interpretMessage({ type, payload }) {
  if (type === EVENT.STATUS) return { kind: 'status', text: String(payload) };
  if (type === EVENT.ERROR) return { kind: 'error', text: String(payload) };
  if (type !== EVENT.INSTALL) return null;
  if (payload.response !== 0) return { kind: 'error', text: 'package needs re-signing' };
  const failed = String(payload.result || '')
    .split('\n')
    .find((line) => line.indexOf('install failed') !== -1);
  return failed ? { kind: 'error', text: failed.trim() } : { kind: 'done', text: '' };
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Thrown when TizenBrew Installer's service is not running and could not be started. */
export class ServiceDownError extends Error {}

function connect() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(INSTALLER_URL);
    socket.onopen = () => resolve(socket);
    socket.onerror = () => reject(new ServiceDownError('installer service not running'));
  });
}

async function connectWithRetry() {
  const deadline = Date.now() + SERVICE_START_TIMEOUT_MS;
  for (;;) {
    try {
      return await connect();
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await delay(CONNECT_RETRY_MS);
    }
  }
}

function startInstallerService() {
  return new Promise((resolve, reject) => {
    tizen.application.launchAppControl(
      new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/service'),
      INSTALLER_SERVICE_ID,
      resolve,
      (error) => reject(new Error(error.message)),
    );
  });
}

/**
 * Installs the latest release through TizenBrew Installer. onStatus receives the service's
 * status ids (e.g. "installStatus.fetching"). The TV closes Tizarr when the install lands.
 */
export async function installLatest(onStatus) {
  let socket;
  try {
    socket = await connect();
  } catch {
    try {
      await startInstallerService();
    } catch {
      // The TV reports "Unknown error" when launching another package's service even when
      // the service does start, so ignore it and check by connecting.
    }
    socket = await connectWithRetry();
    await delay(SERVICE_SETTLE_MS);
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('no answer from installer')),
      INSTALL_TIMEOUT_MS,
    );
    socket.onmessage = (event) => {
      const message = interpretMessage(JSON.parse(event.data));
      if (!message) return;
      if (message.kind === 'status') return onStatus(message.text);
      clearTimeout(timer);
      socket.close();
      if (message.kind === 'done') resolve();
      else reject(new Error(message.text));
    };
    socket.send(JSON.stringify({ type: EVENT.INSTALL, payload: { url: REPO } }));
  });
}
