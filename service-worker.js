// Simple Service Worker for PWA
const CACHE_NAME = 'shineshone-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate worker immediately
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // Become available to all pages
});

// self.addEventListener('fetch', (event) => {
//   // Pass through all requests - no caching strategy yet to avoid dev issues
//   // This empty handler satisfies PWA requirements
// });
