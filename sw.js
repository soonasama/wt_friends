const WT_CACHE_VER = 'wt-friends-20261124-4';
self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  // 네트워크 우선: 홈 화면 앱에서도 항상 최신 시트·최신 코드 반영
  return;
});
