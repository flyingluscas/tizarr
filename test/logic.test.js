const assert = require('assert');
const L = require('../logic.js');

const movie = {
  title: 'Dune', year: 2021, overview: 'Spice.', tmdbId: 438631,
  images: [
    { coverType: 'fanart', remoteUrl: 'https://image.tmdb.org/t/p/original/f.jpg' },
    { coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/p.jpg' },
  ],
};

// toItem
const it = L.toItem('movie', movie);
assert.strictEqual(it.kind, 'movie');
assert.strictEqual(it.title, 'Dune');
assert.strictEqual(it.year, 2021);
assert.strictEqual(it.poster, 'https://image.tmdb.org/t/p/w342/p.jpg');
assert.strictEqual(it.inLibrary, false);
assert.strictEqual(it.raw, movie);
assert.strictEqual(L.toItem('show', { title: 'X', id: 5 }).inLibrary, true);
assert.strictEqual(L.toItem('show', { title: 'X' }).poster, '');
assert.strictEqual(L.toItem('show', { title: 'X', images: [{ coverType: 'poster', url: '/local.jpg' }] }).poster, '');

// interleave
assert.deepStrictEqual(L.interleave([1, 2, 3], ['a']), [1, 'a', 2, 3]);
assert.deepStrictEqual(L.interleave([], ['a', 'b']), ['a', 'b']);

// buildRequestBody
const srv = { url: 'http://r', apiKey: 'k', qualityProfileId: 4, rootFolderPath: '/movies' };
let b = L.buildRequestBody('movie', movie, srv);
assert.strictEqual(b.tmdbId, 438631);
assert.strictEqual(b.qualityProfileId, 4);
assert.strictEqual(b.rootFolderPath, '/movies');
assert.strictEqual(b.monitored, true);
assert.strictEqual(b.minimumAvailability, 'released');
assert.deepStrictEqual(b.addOptions, { searchForMovie: true });
assert.strictEqual(movie.qualityProfileId, undefined, 'lookup result must not be mutated');
b = L.buildRequestBody('show', { title: 'S', tvdbId: 9 }, srv);
assert.strictEqual(b.tvdbId, 9);
assert.strictEqual(b.seasonFolder, true);
assert.deepStrictEqual(b.addOptions, { monitor: 'all', searchForMissingEpisodes: true });

// serverReady / isConfigValid
assert.strictEqual(L.serverReady(srv), true);
assert.strictEqual(L.serverReady({ url: 'http://r', apiKey: 'k', qualityProfileId: 0, rootFolderPath: '/m' }), false);
const empty = { url: '', apiKey: '', qualityProfileId: 0, rootFolderPath: '' };
assert.strictEqual(L.isConfigValid({ sonarr: empty, radarr: empty }), false);
assert.strictEqual(L.isConfigValid({ sonarr: empty, radarr: srv }), true);
assert.strictEqual(L.isConfigValid(null), false);

// errorMessage
assert.strictEqual(L.errorMessage(400, [{ errorMessage: 'This movie has already been added' }]), 'This movie has already been added');
assert.strictEqual(L.errorMessage(500, { message: 'boom' }), 'boom');
assert.strictEqual(L.errorMessage(502, null), 'HTTP 502');

// normalizeUrl
assert.strictEqual(L.normalizeUrl(' sonarr.lan/ '), 'http://sonarr.lan');
assert.strictEqual(L.normalizeUrl('https://x.y:8989//'), 'https://x.y:8989');
assert.strictEqual(L.normalizeUrl(''), '');

console.log('ok');
