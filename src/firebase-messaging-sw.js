// firebase-messaging-sw.js — Service Worker for FCM push + PWA precache.
// Processed by vite-plugin-pwa (injectManifest strategy): self.__WB_MANIFEST is
// replaced with the generated precache list at build time.

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js')

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

// Notification click → reopen/focus app with FCM deep-link URL params
self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var data = event.notification.data || {}
  var params = new URLSearchParams()
  Object.keys(data).forEach(function (k) {
    if (typeof data[k] === 'string') params.set(k, data[k])
  })
  // Use absolute URL — clients.openWindow requires it in most browsers
  var path = params.toString() ? '/?' + params.toString() : '/'
  var url = self.location.origin + path

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i]
        if ('navigate' in client) {
          return client.navigate(url).then(function () { return client.focus() })
        }
      }
      return clients.openWindow(url)
    })
  )
})
