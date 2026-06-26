// firebase-messaging-sw.js — Service Worker for FCM push + PWA precache.
// Processed by vite-plugin-pwa (injectManifest strategy): self.__WB_MANIFEST is
// replaced with the generated precache list at build time.

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js')

// Force new SW to activate immediately without waiting for tabs to close.
// Without this, the updated notificationclick handler would stay "waiting" until
// every open window is manually closed and reopened.
self.addEventListener('install', function() { self.skipWaiting() })
self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim())
})

// Precache app shell — entries injected by vite-plugin-pwa at build time
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || [])

firebase.initializeApp({
  apiKey: 'AIzaSyDdS-CJouams6d6SeNJu-j8ulCUm7IAR-M',
  authDomain: 'blood-help-ff50b.firebaseapp.com',
  projectId: 'blood-help-ff50b',
  storageBucket: 'blood-help-ff50b.firebasestorage.app',
  messagingSenderId: '665270781901',
  appId: '1:665270781901:web:dab1a772396cc2d1126684',
})

const messaging = firebase.messaging()

// Background message handler — shows notification when app is not focused
messaging.onBackgroundMessage(function (payload) {
  var title = (payload.notification && payload.notification.title) || 'Blood Help'
  var body = (payload.notification && payload.notification.body) || ''
  return self.registration.showNotification(title, {
    body: body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: payload.data || {},
    requireInteraction: true,
  })
})

// Notification click handler — two paths depending on whether the app is already open:
//   Warm start (app backgrounded): postMessage the FCM data directly to the running React
//     app so it can show the modal without a full page reload. client.navigate() is unreliable
//     here because Workbox's precacheAndRoute only caches bare '/' — a query-string URL like
//     '/?fcm_type=...' falls through to the network, which can be slow or fail on mobile.
//   Cold start (app closed): openWindow with URL params so initAuth can read them on boot.
self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var data = event.notification.data || {}

  // Build fallback URL for cold-start path (openWindow)
  var params = new URLSearchParams()
  Object.keys(data).forEach(function (k) {
    if (typeof data[k] === 'string') params.set(k, data[k])
  })
  var path = params.toString() ? '/?' + params.toString() : '/'
  var url = self.location.origin + path

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      if (windowClients.length > 0) {
        // Warm start — deliver data directly, no reload needed
        var client = windowClients[0]
        client.postMessage({ type: 'fcm_notification_click', data: data })
        return client.focus()
      }
      // Cold start — open fresh window; initAuth will read URL params on boot
      return clients.openWindow(url)
    })
  )
})
