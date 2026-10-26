(function () {
  var query = self.location.search || '';
  var match = /(?:^|&)v=([^&]*)/.exec(query.replace(/^\?/, ''));
  var version = match ? decodeURIComponent(match[1]) : 'dev';
  var cacheName = 'jargle-' + version;
  var optional = [
    './content/bundle.json',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/favicon.svg'
  ];

  function cacheOne(cache, url) {
    return fetch(url).then(function (response) {
      if (response && response.ok) return cache.put(url, response);
      return null;
    }).catch(function () { return null; });
  }

  function cacheFontsOf(cache, sheetUrl) {
    var base = new URL(sheetUrl, self.location.href);
    return fetch(sheetUrl).then(function (response) {
      return response.text();
    }).then(function (css) {
      var files = [];
      var match;
      var urls = /url\(["']?([^"')]+)["']?\)/g;
      while ((match = urls.exec(css))) {
        // Every browser that runs the app reads woff2, so the older woff copies are skipped.
        if (/\.woff2$/.test(match[1])) files.push(new URL(match[1], base).href);
      }
      return Promise.all(files.map(function (url) { return cacheOne(cache, url); }));
    }).catch(function () { return null; });
  }

  self.addEventListener('install', function (event) {
    event.waitUntil(caches.open(cacheName).then(function (cache) {
      return fetch('./index.html').then(function (response) {
        if (!response || !response.ok) throw new Error('index');
        var copy = response.clone();
        var htmlCopy = response.clone();
        return Promise.all([
          cache.put('./index.html', response),
          cache.put('./', copy)
        ]).then(function () {
          return htmlCopy.text().then(function (html) {
            var found = [];
            var match;
            var tags = /(?:src|href)=["']([^"']+)["']/g;
            while ((match = tags.exec(html))) {
              if (match[1].indexOf('./') === 0 || match[1].indexOf('assets/') === 0) found.push(match[1]);
            }
            var urls = found.concat(optional);
            var unique = [];
            urls.forEach(function (url) {
              if (unique.indexOf(url) < 0) unique.push(url);
            });
            return Promise.all(unique.map(function (url) { return cacheOne(cache, url); })).then(function () {
              // Fonts are linked from the CSS, not the HTML, so read each stylesheet for its url(...) files.
              var sheets = unique.filter(function (url) { return /\.css$/.test(url); });
              return Promise.all(sheets.map(function (sheet) { return cacheFontsOf(cache, sheet); }));
            });
          });
        });
      });
    }).then(function () {
      return self.skipWaiting();
    }));
  });

  self.addEventListener('activate', function (event) {
    event.waitUntil(caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key.indexOf('jargle-') === 0 && key !== cacheName) return caches.delete(key);
        return null;
      }));
    }).then(function () { return self.clients.claim(); }));
  });

  // Servers can send "Vary: Origin". Chrome adds an Origin header to the page's module script and
  // stylesheet requests, but the copies saved at install time were fetched without one, so a plain
  // match would miss them offline. The URL alone is enough to find the right file here.
  var matchOptions = { ignoreVary: true };

  self.addEventListener('fetch', function (event) {
    var request = event.request;
    if (request.method !== 'GET' || request.url.indexOf(self.location.origin) !== 0) return;
    var isNavigation = request.mode === 'navigate';
    var path = request.url.split('?')[0].split('#')[0];
    var isContent = /content\/bundle\.json$/.test(path);
    if (isNavigation) {
      event.respondWith(fetch(request).then(function (response) {
        if (response && response.ok && response.type === 'basic') {
          return caches.open(cacheName).then(function (cache) {
            return Promise.all([
              cache.put('./index.html', response.clone()),
              cache.put('./', response.clone())
            ]).catch(function () { return null; });
          }).catch(function () { return null; }).then(function () { return response; });
        }
        return response;
      }).catch(function () { return caches.match('./index.html', matchOptions); }));
      return;
    }
    if (isContent) {
      event.respondWith(fetch(request).then(function (response) {
        if (response && response.ok) caches.open(cacheName).then(function (cache) { cache.put('./content/bundle.json', response.clone()); });
        return response;
      }).catch(function () { return caches.match('./content/bundle.json', matchOptions); }));
      return;
    }
    event.respondWith(caches.match(request, matchOptions).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          caches.open(cacheName).then(function (cache) { cache.put(request, response.clone()); });
        }
        return response;
      });
    }));
  });
}());
