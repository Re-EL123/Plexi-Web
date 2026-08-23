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

  // ======== PWA INSTALL PROMPT ======== //
  let deferredInstall = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function wasInstallDismissed() {
    try { return localStorage.getItem('plexi_install_dismissed') === 'true'; } catch (_) { return false; }
  }

  function rememberInstallDismissed() {
    try { localStorage.setItem('plexi_install_dismissed', 'true'); } catch (_) {}
  }

  function showInstallBanner() {
    if (!deferredInstall || isStandalone() || document.getElementById('plexi-install-banner')) return;
    const el = document.createElement('div');
    el.id = 'plexi-install-banner';
    el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:20px;z-index:9999;' +
      'display:flex;align-items:center;gap:12px;padding:12px 18px;background:#fff;color:#1a1a2e;' +
      'border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.18);max-width:min(560px,92vw);font-family:inherit;';
    el.innerHTML =
      '<span style="font-size:13px;font-weight:600;line-height:1.4;">Install Plexi Digital Mall for a faster, full-screen experience.</span>' +
      '<button id="plexi-install-yes" class="btn btn-primary btn-sm" style="flex-shrink:0;">Install</button>' +
      '<button id="plexi-install-no" class="btn btn-ghost btn-sm" aria-label="Dismiss" style="flex-shrink:0;">&#10005;</button>';
    el.querySelector('#plexi-install-yes').addEventListener('click', async () => {
      const prompt = deferredInstall;
      hideInstallBanner();
      deferredInstall = null;
      if (!prompt) return;
      try { prompt.prompt(); await prompt.userChoice; } catch (_) {}
    });
    el.querySelector('#plexi-install-no').addEventListener('click', () => {
      rememberInstallDismissed();
      hideInstallBanner();
    });
    document.body.appendChild(el);
  }

  function hideInstallBanner() {
    const el = document.getElementById('plexi-install-banner');
    if (el) el.remove();
  }

  function initInstallPrompt() {
    if (isStandalone() || wasInstallDismissed()) return;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredInstall = e;
      setTimeout(showInstallBanner, 6000);
    });
    window.addEventListener('appinstalled', () => {
      hideInstallBanner();
      deferredInstall = null;
      if (window.UI && UI.toast) UI.toast('Plexi installed! Open it from your home screen.', 'success');
    });
  }

  return {
    init, isSupported, getPermissionState, requestPermission,
    subscribe, unsubscribe, getSubscription,
    showPermissionPrompt, enablePush, dismissPrompt, shouldPrompt,
    initInstallPrompt, showInstallBanner, hideInstallBanner
  };
})();

window.PushManager = PushManager;
if (typeof document !== 'undefined') PushManager.initInstallPrompt();
