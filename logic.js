// Pure functions, shared by app.js (browser) and test/logic.test.js (Node).
// Keep to ES2017: the target TV runs Chromium 63.
var Logic = (function () {
  'use strict';

  function posterUrl(images) {
    var list = images || [];
    for (var i = 0; i < list.length; i++) {
      // Only remoteUrl is reachable without auth; `url` points at the *arr server.
      if (list[i].coverType === 'poster' && list[i].remoteUrl) {
        return list[i].remoteUrl.replace('/t/p/original/', '/t/p/w342/');
      }
    }
    return '';
  }

  function toItem(kind, r) {
    return {
      kind: kind,
      title: r.title,
      year: r.year || '',
      overview: r.overview || '',
      poster: posterUrl(r.images),
      inLibrary: (r.id || 0) > 0,
      raw: r
    };
  }

  function interleave(a, b) {
    var out = [];
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      if (i < a.length) out.push(a[i]);
      if (i < b.length) out.push(b[i]);
    }
    return out;
  }

  function buildRequestBody(kind, r, server) {
    var body = Object.assign({}, r, {
      qualityProfileId: server.qualityProfileId,
      rootFolderPath: server.rootFolderPath,
      monitored: true
    });
    if (kind === 'show') {
      body.seasonFolder = true;
      body.addOptions = { monitor: 'all', searchForMissingEpisodes: true };
    } else {
      body.minimumAvailability = 'released';
      body.addOptions = { searchForMovie: true };
    }
    return body;
  }

  function serverReady(s) {
    return !!(s && s.url && s.apiKey && s.qualityProfileId && s.rootFolderPath);
  }

  function isConfigValid(c) {
    return !!c && (serverReady(c.sonarr) || serverReady(c.radarr));
  }

  function errorMessage(status, data) {
    if (Array.isArray(data) && data.length && data[0].errorMessage) return data[0].errorMessage;
    if (data && data.message) return data.message;
    return 'HTTP ' + status;
  }

  function normalizeUrl(u) {
    u = (u || '').trim().replace(/\/+$/, '');
    if (u && !/^https?:\/\//i.test(u)) u = 'http://' + u;
    return u;
  }

  return {
    toItem: toItem,
    interleave: interleave,
    buildRequestBody: buildRequestBody,
    serverReady: serverReady,
    isConfigValid: isConfigValid,
    errorMessage: errorMessage,
    normalizeUrl: normalizeUrl
  };
})();

if (typeof module !== 'undefined') module.exports = Logic;
