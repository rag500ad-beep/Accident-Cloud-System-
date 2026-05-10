// firebase-messaging-sw.js
// ⚠️  هذا الملف يجب يكون في جذر المشروع (نفس مستوى index.html)
// ⚠️  لا تغير اسمه — Firebase يبحث عنه باسم firebase-messaging-sw.js تحديدًا

importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

// ---------------------------------------------------------------------------
// Firebase Configuration — نفس القيم الموجودة في notifications.js
// ---------------------------------------------------------------------------
firebase.initializeApp({
  apiKey: "AIzaSyD5i7LkVRCKg2L2PrzwNm7PeDYKytR-jOc",
authDomain: "accident-cloud-system-41ad9.firebaseapp.com",
projectId: "accident-cloud-system-41ad9",
storageBucket: "accident-cloud-system-41ad9.firebasestorage.app",
messagingSenderId: "460550861200",
appId: "1:460550861200:web:bd0a77ac5a6b29a52c4315"      // ← استبدليها من Firebase Console
});

// ---------------------------------------------------------------------------
// تهيئة Firebase Messaging داخل الـ Service Worker
// ---------------------------------------------------------------------------
const messaging = firebase.messaging();

// ---------------------------------------------------------------------------
// معالجة الإشعارات الواردة في الخلفية (التطبيق مغلق أو مخفي)
// ---------------------------------------------------------------------------
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Background notification received:", payload);

  const title = payload.notification?.title || "Accident Cloud System";
  const body  = payload.notification?.body  || "You have a new notification.";
  const icon  = payload.notification?.icon  || "/icon-192.png";

  self.registration.showNotification(title, {
    body:    body,
    icon:    icon,
    badge:   "/badge-72.png",
    tag:     "accident-notification",      // يمنع تراكم الإشعارات المتكررة
    renotify: true,
    data:    payload.data || {}
  });
});

// ---------------------------------------------------------------------------
// عند النقر على الإشعار — يفتح التطبيق أو يجلبه للمقدمة
// ---------------------------------------------------------------------------
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // لو التطبيق مفتوح بالفعل، اجلبه للمقدمة
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      // لو مغلق، افتح نافذة جديدة
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});

// ---------------------------------------------------------------------------
// تفعيل الـ Service Worker فورًا بدون انتظار إغلاق التبويب
// ---------------------------------------------------------------------------
self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));
