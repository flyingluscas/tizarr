// Download queue (grouped per title) and upcoming episodes for the Downloads screen, plus the
// two queue actions. Pure helpers are exported for tests.
import { serverReady, SERVER_NAMES } from '../config.js';
import { deleteTitle, getCalendar, getQueueWithTitles, removeQueueItems } from './arr.js';
import { KINDS, posterUrl } from './media.js';

const TITLE_ID = { movie: 'movieId', show: 'seriesId' };
// Most "active" status wins when a title has several queue records.
const STATUS_ORDER = ['downloading', 'warning', 'paused', 'delay', 'queued', 'completed'];
const UPCOMING_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 1288490188 → "1.2 GB"; 524288000 → "500 MB". */
export function formatSize(bytes) {
  if (!bytes) return '';
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

/** Sonarr/Radarr "d.hh:mm:ss" or "hh:mm:ss" → "1d 2h", "2h 3m", "12m", "<1m". */
export function formatTimeLeft(value) {
  if (!value) return '';
  const [days, clock] = value.indexOf('.') > 0 ? value.split('.') : ['0', value];
  const [hours, minutes] = clock.split(':').map(Number);
  const d = Number(days);
  if (d) return `${d}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return minutes ? `${minutes}m` : '<1m';
}

function statusOf(record) {
  if (record.trackedDownloadStatus === 'warning' || record.trackedDownloadStatus === 'error') {
    return 'warning';
  }
  return STATUS_ORDER.includes(record.status) ? record.status : 'queued';
}

/** One entry per title: summed progress, the most active status and every queue id. */
export function groupQueue(kind, records) {
  const groups = new Map();
  for (const record of records) {
    const titleId = record[TITLE_ID[kind]];
    if (!titleId) continue;
    const owner = kind === 'movie' ? record.movie : record.series;
    let group = groups.get(titleId);
    if (!group) {
      group = {
        kind,
        titleId,
        title: owner ? owner.title : record.title,
        year: owner ? owner.year : '',
        poster: owner ? posterUrl(owner.images) : '',
        size: 0,
        left: 0,
        timeLeft: '',
        status: 'completed',
        episodes: 0,
        queueIds: [],
      };
      groups.set(titleId, group);
    }
    group.queueIds.push(record.id);
    group.size += record.size || 0;
    group.left += record.sizeleft || 0;
    if (record.episode) group.episodes += 1;
    if (record.timeleft && record.timeleft > group.timeLeft) group.timeLeft = record.timeleft;
    const status = statusOf(record);
    if (STATUS_ORDER.indexOf(status) < STATUS_ORDER.indexOf(group.status)) group.status = status;
  }
  return Array.from(groups.values()).map((group) => ({
    ...group,
    progress: group.size ? Math.round(((group.size - group.left) / group.size) * 100) : 0,
  }));
}

/** Calendar entries → [{ series, code: "S2E04", title, airDate }]. */
export function toUpcoming(episodes) {
  return episodes
    .filter((episode) => episode.airDateUtc)
    .sort((a, b) => (a.airDateUtc < b.airDateUtc ? -1 : 1))
    .map((episode) => ({
      series: episode.series ? episode.series.title : '',
      code: `S${episode.seasonNumber}E${String(episode.episodeNumber).padStart(2, '0')}`,
      title: episode.title || '',
      airDate: episode.airDateUtc,
    }));
}

/** { items, errors } from both servers' queues. */
export async function loadDownloads(config) {
  const errors = [];
  const sides = await Promise.all(
    ['movie', 'show'].map(async (kind) => {
      const name = KINDS[kind].server;
      if (!serverReady(config[name])) return [];
      try {
        return groupQueue(kind, await getQueueWithTitles(config[name], kind));
      } catch (error) {
        errors.push(`${SERVER_NAMES[name]}: ${error.message}`);
        return [];
      }
    }),
  );
  return { items: sides[0].concat(sides[1]), errors };
}

export async function loadUpcoming(config, now = Date.now()) {
  if (!serverReady(config.sonarr)) return [];
  const start = new Date(now).toISOString();
  const end = new Date(now + UPCOMING_DAYS * DAY_MS).toISOString();
  return toUpcoming(await getCalendar(config.sonarr, start, end));
}

/** Queue ids belonging to one title. */
export async function queueIdsFor(config, kind, titleId) {
  const records = await getQueueWithTitles(config[KINDS[kind].server], kind);
  return records.filter((record) => record[TITLE_ID[kind]] === titleId).map((record) => record.id);
}

/** Drops the current download(s) and blocklists the release; the server looks for another. */
export async function tryAnotherRelease(config, kind, titleId) {
  const ids = await queueIdsFor(config, kind, titleId);
  if (ids.length) await removeQueueItems(config[KINDS[kind].server], ids, { blocklist: true });
  return ids.length;
}

/** Stops any download, removes the title and deletes its files. */
export async function cancelAndDelete(config, kind, titleId) {
  const server = config[KINDS[kind].server];
  const ids = await queueIdsFor(config, kind, titleId);
  if (ids.length) await removeQueueItems(server, ids, { blocklist: false });
  await deleteTitle(server, kind, titleId);
}
