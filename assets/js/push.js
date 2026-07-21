// ============================================================
// PLEXI DIGITAL MALL — Push Notification Manager
// Handles permission request, subscription, and backend sync
// ============================================================

const PushManager = (() => {
  let registration = null;
  let supported = 'serviceWorker' in navigator && 'PushManager' in window;

  function getVapidKey() { return CONFIG.VAPID_PUBLIC_KEY || ''; }

  async function init() {
    if (!supported || !getVapidKey()) return false;
    try {
      registration = await navigator.serviceWorker.ready;
      return true;
    } catch (_) { return false; }
  }

  function isSupported() { return supported && !!getVapidKey(); }

  async function getPermissionState() {
    if (!supported) return 'unsupported';
    return Notification.permission;
  }

  async function requestPermission() {
    if (!supported) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    const result = await Notification.requestPermission();
    return result;
  }

  async function subscribe() {
    if (!isSupported() || !registration) return null;
    if (Notification.permission !== 'granted') return null;

    try {
      const existing = await registration.pushManager.getSubscription();
      if (existing) return existing;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(getVapidKey())
      });

      await sendSubscriptionToBackend(subscription);
      return subscription;
    } catch (_) { return null; }
  }

  async function unsubscribe() {
    if (!registration) return;
    try {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await removeSubscriptionFromBackend(subscription);
      }
    } catch (_) {}
  }

  async function getSubscription() {
    if (!registration) return null;
    try {
      return await registration.pushManager.getSubscription();
    } catch (_) { return null; }
  }

  async function sendSubscriptionToBackend(subscription) {
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    if (!token) return;

    try {
      await fetch(`${CONFIG.API_URL}/users?action=push-subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subscription: subscription.toJSON() })
      });
    } catch (_) {}
  }

  async function removeSubscriptionFromBackend(subscription) {
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    if (!token) return;

    try {
      await fetch(`${CONFIG.API_URL}/users?action=push-unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
    } catch (_) {}
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function showPermissionPrompt() {
    const state = await getPermissionState();
    if (state !== 'default') return;

    UI.createModal({
      id: 'push-prompt',
      title: 'Enable Notifications',
      content: `<div style="text-align:center;padding:var(--space-md) 0;">
        <div style="font-size:48px;margin-bottom:var(--space-md);">🔔</div>
        <p style="color:var(--text-secondary);margin-bottom:var(--space-md);">Stay updated on orders, messages, and store activity. Enable push notifications so you never miss anything important.</p>
      </div>`,
      footer: `<button class="btn btn-ghost" onclick="UI.closeModal('push-prompt');PushManager.dismissPrompt();">Not Now</button>
               <button class="btn btn-primary" onclick="PushManager.enablePush()">Enable Notifications</button>`
    });
  }

  async function enablePush() {
    UI.closeModal('push-prompt');
    const result = await requestPermission();
    if (result === 'granted') {
      await subscribe();
      UI.toast('Notifications enabled!', 'success');
    } else if (result === 'denied') {
      UI.toast('Notifications blocked. Enable in browser settings.', 'warning');
    }
    dismissPrompt();
  }

  function dismissPrompt() {
    try { sessionStorage.setItem('plexi_push_prompted', 'true'); } catch (_) {}
  }

  function shouldPrompt() {
    if (!isSupported()) return false;
    if (Notification.permission !== 'default') return false;
    try { return sessionStorage.getItem('plexi_push_prompted') !== 'true'; } catch (_) { return true; }
  }

  return {
    init, isSupported, getPermissionState, requestPermission,
    subscribe, unsubscribe, getSubscription,
    showPermissionPrompt, enablePush, dismissPrompt, shouldPrompt
  };
})();

window.PushManager = PushManager;
