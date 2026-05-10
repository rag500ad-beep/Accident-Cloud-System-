// notifications.js
// Accident Cloud System - Firebase Cloud Messaging (FCM) Module
// Handles permission requests, token management, foreground notifications,
// and real-time Firestore listeners for accident events.

import { initializeApp }          from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// ---------------------------------------------------------------------------
// Firebase Configuration
// Replace messagingSenderId and appId with values from:
// Firebase Console > Project Settings > General > Your Apps
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyD5i7LkVRCKg2L2PrzwNm7PeDYKytR-jOc",
authDomain: "accident-cloud-system-41ad9.firebaseapp.com",
projectId: "accident-cloud-system-41ad9",
storageBucket: "accident-cloud-system-41ad9.firebasestorage.app",
messagingSenderId: "460550861200",
appId: "1:460550861200:web:bd0a77ac5a6b29a52c4315"
};

// VAPID Key (Web Push Certificate) from Firebase Console > Cloud Messaging > Web configuration
const VAPID_KEY =
  "BHMQdAW-Gt5LYVCyT1n7syAgP1hBLnKbMMOKBpiTmmVg777_5Sgi3_gAvZHe5mNpCytcbDHwOyAJYMwlE_rJ6gk";

// ---------------------------------------------------------------------------
// Initialise Firebase Services
// ---------------------------------------------------------------------------
const app       = initializeApp(firebaseConfig);
const messaging = getMessaging(app);
const db        = getFirestore(app);

// ---------------------------------------------------------------------------
// 1. Request Notification Permission and Retrieve FCM Token
// ---------------------------------------------------------------------------

/**
 * Requests browser notification permission from the user.
 * On approval, retrieves the FCM device token and stores it in Firestore.
 *
 * @returns {Promise<string|null>} The FCM token, or null if permission was denied.
 */
export async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission denied by user.');
      return null;
    }

    console.log('[FCM] Notification permission granted.');

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });

    if (!token) {
      console.warn('[FCM] No registration token available. Check VAPID key and service worker registration.');
      return null;
    }

    console.log('[FCM] Device token retrieved:', token);
    await saveTokenToFirestore(token);
    return token;

  } catch (error) {
    console.error('[FCM] Error requesting notification permission:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// 2. Save FCM Token to Firestore
// ---------------------------------------------------------------------------

/**
 * Stores the FCM device token in the Firestore "fcm_tokens" collection.
 * Tokens are used server-side (or via Cloud Functions) to send targeted pushes.
 *
 * @param {string} token - The FCM registration token.
 */
async function saveTokenToFirestore(token) {
  try {
    await addDoc(collection(db, "fcm_tokens"), {
      token:     token,
      createdAt: serverTimestamp(),
      userAgent: navigator.userAgent
    });
    console.log('[FCM] Token saved to Firestore.');
  } catch (error) {
    console.error('[FCM] Failed to save token to Firestore:', error);
  }
}

// ---------------------------------------------------------------------------
// 3. Listen for Foreground Notifications
// ---------------------------------------------------------------------------

/**
 * Registers an onMessage listener for push notifications received while
 * the application tab is active (foreground).
 * Displays an in-app toast notification instead of a system notification.
 */
export function listenToForegroundNotifications() {
  onMessage(messaging, (payload) => {
    console.log('[FCM] Foreground notification received:', payload);
    const title = payload.notification?.title || 'Accident Cloud System';
    const body  = payload.notification?.body  || 'You have a new notification.';
    showToastNotification(title, body, 'info');
  });
}

export function listenToAccidentEvents() {
  const accidentsRef = collection(db, "accidents");
  const q = query(accidentsRef, orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {

      if (change.type === "added") {
        const data = change.doc.data();
        // Suppress initial load — only react to documents added after listener attaches.
        // If you do NOT want the initial batch to trigger alerts, track document IDs on load.
        showToastNotification(
          "New Accident Reported",
          `Location: ${data.location || "Unspecified"} — A new accident has been submitted.`,
          "warning"
        );
      }

      if (change.type === "modified") {
        const data = change.doc.data();
        if (data.status === "reviewed") {
          showToastNotification(
            "Report Status Updated",
            "Your accident report has been reviewed by the administration.",
            "success"
          );
        }
      }

    });
  }, (error) => {
    console.error('[FCM] Firestore listener error:', error);
  });
}

// ---------------------------------------------------------------------------
// 5. In-App Toast Notification
// ---------------------------------------------------------------------------

/**
 * Renders a styled, dismissible toast notification inside the current page.
 * Used for foreground notifications and Firestore-triggered alerts.
 *
 * @param {string} title  - Notification heading.
 * @param {string} body   - Notification detail text.
 * @param {'info'|'success'|'warning'|'error'} type - Visual severity.
 * @param {number} [duration=6000] - Auto-dismiss delay in milliseconds.
 */
export function showToastNotification(title, body, type = 'info', duration = 6000) {
  const colors = {
    info:    { bg: '#1a56db', border: '#1e429f' },
    success: { bg: '#057a55', border: '#046c4e' },
    warning: { bg: '#c27803', border: '#9f580a' },
    error:   { bg: '#c81e1e', border: '#9b1c1c' }
  };
  const scheme = colors[type] || colors.info;

  injectToastStyles();

  const toast = document.createElement('div');
  toast.className = 'acs-toast';
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.style.cssText = `
    background: ${scheme.bg};
    border-left: 4px solid ${scheme.border};
  `;

  toast.innerHTML = `
    <div class="acs-toast-content">
      <p class="acs-toast-title">${sanitise(title)}</p>
      <p class="acs-toast-body">${sanitise(body)}</p>
    </div>
    <button class="acs-toast-close" aria-label="Dismiss notification">&times;</button>
  `;

  // Ensure toast container exists
  let container = document.getElementById('acs-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'acs-toast-container';
    document.body.appendChild(container);
  }

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('acs-toast-visible'));

  // Dismiss on close button
  toast.querySelector('.acs-toast-close').addEventListener('click', () => dismissToast(toast));

  // Auto-dismiss
  const timer = setTimeout(() => dismissToast(toast), duration);
  toast.dataset.timer = timer;
}

function dismissToast(toast) {
  clearTimeout(Number(toast.dataset.timer));
  toast.classList.remove('acs-toast-visible');
  toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}

function sanitise(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

let _stylesInjected = false;
function injectToastStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    #acs-toast-container {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 360px;
      pointer-events: none;
    }
    .acs-toast {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 6px;
      color: #ffffff;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      pointer-events: all;
      opacity: 0;
      transform: translateX(24px);
      transition: opacity 0.25s ease, transform 0.25s ease;
    }
    .acs-toast.acs-toast-visible {
      opacity: 1;
      transform: translateX(0);
    }
    .acs-toast-content { flex: 1; }
    .acs-toast-title {
      margin: 0 0 4px 0;
      font-weight: 600;
      font-size: 14px;
    }
    .acs-toast-body {
      margin: 0;
      font-size: 13px;
      opacity: 0.9;
    }
    .acs-toast-close {
      background: none;
      border: none;
      color: rgba(255,255,255,0.75);
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 0;
      flex-shrink: 0;
      transition: color 0.15s;
    }
    .acs-toast-close:hover { color: #ffffff; }
  `;
  document.head.appendChild(style);
}
