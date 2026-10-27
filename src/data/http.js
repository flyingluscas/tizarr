// JSON over XHR. XHR instead of fetch: Chromium 63 has no AbortController, and XHR gives us
// a timeout for free.

const TIMEOUT_MS = 15000;

/** Rejects with an Error carrying `status` (0 for network failures and timeouts). */
export function requestJson(method, url, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.timeout = TIMEOUT_MS;
    for (const name of Object.keys(headers)) xhr.setRequestHeader(name, headers[name]);
    if (body) xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // Non-JSON body (e.g. an HTML error page).
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(Object.assign(new Error(`HTTP ${xhr.status}`), { status: xhr.status, data }));
    };
    xhr.onerror = xhr.ontimeout = () => reject(Object.assign(new Error('network'), { status: 0 }));
    xhr.send(body ? JSON.stringify(body) : null);
  });
}
