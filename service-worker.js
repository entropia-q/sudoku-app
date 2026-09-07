/* 数独アプリ用の簡単な Service Worker
 * - install: アプリ一式を事前キャッシュ（オフライン起動用）
 * - fetch:   キャッシュ優先 + 裏で更新（stale-while-revalidate）
 *   オフラインかつ未キャッシュのナビゲーション要求は index.html を返す
 *
 * アプリを更新したら CACHE のバージョン名を上げると、古いキャッシュが破棄される。
 */
const CACHE = "sudoku-cache-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          // 同一オリジンの正常なレスポンスだけキャッシュを更新
          if (
            response &&
            response.ok &&
            new URL(request.url).origin === self.location.origin
          ) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          // オフライン: ナビゲーションなら index.html にフォールバック
          if (request.mode === "navigate") return caches.match("./index.html");
          return cached;
        });

      return cached || network;
    })
  );
});
