import assert from 'node:assert/strict';
import { test } from 'node:test';
import { embedUrl, isYouTubeId, pickTrailer } from '../src/data/trailers.js';

test('isYouTubeId accepts only 11-character YouTube ids', () => {
  assert.equal(isYouTubeId('w0HgHet0sxg'), true);
  assert.equal(isYouTubeId('w0HgHet0sx'), false);
  assert.equal(isYouTubeId('"><script>1'), false);
  assert.equal(isYouTubeId(null), false);
});

test('pickTrailer prefers official trailers, then trailers, then teasers', () => {
  const videos = [
    { site: 'YouTube', type: 'Teaser', key: 'teaser00001' },
    { site: 'Vimeo', type: 'Trailer', official: true, key: 'vimeo000001' },
    { site: 'YouTube', type: 'Trailer', key: 'trailer0001' },
    { site: 'YouTube', type: 'Trailer', official: true, key: 'official001' },
  ];
  assert.equal(pickTrailer(videos), 'official001');
  assert.equal(pickTrailer(videos.slice(0, 3)), 'trailer0001');
  assert.equal(pickTrailer(videos.slice(0, 1)), 'teaser00001');
  assert.equal(pickTrailer([]), null);
});

test('embedUrl builds the nocookie URL and refuses bad ids', () => {
  assert.ok(
    embedUrl('w0HgHet0sxg').startsWith('https://www.youtube-nocookie.com/embed/w0HgHet0sxg?'),
  );
  assert.equal(embedUrl('javascript:x'), '');
});
