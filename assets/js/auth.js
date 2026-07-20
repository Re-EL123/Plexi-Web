// ============================================================
// PLEXI DIGITAL MALL — Auth Manager
// ============================================================

const Auth = (() => {
  function getToken()     { return localStorage.getItem(CONFIG.TOKEN_KEY); }
  function getUser()      { try { return JSON.parse(localStorage.getItem(CONFIG.USER_KEY)); } catch { return null; } }
  function isLoggedIn()   { return !!getToken(); }

  function saveSession(token, user) {
    if (!token || !user) return;
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
  }

  function getRole() {
    const user = getUser();
    return user?.role || null;
  }

  function redirect(role) {
    const map = {
      admin:   '../dashboard/admin.html',
      seller:  '/dashboard/seller.html',
      shopper: '../dashboard/shopper.html'
    };
    // Safety check: if role is missing, go to index
    window.location.href = map[role] || '../index.html';
  }

  async function login(email, password) {
    const response = await api.auth.login(email, password);
    
    // BACKEND CHECK: response.data contains { user, session }
    const result = response.data || response;
    const token = result.session?.access_token;
    const user = result.user;

    if (token && user) {
      saveSession(token, user);
      return user;
    }
    throw new Error(response.error || 'Login failed: Invalid credentials');
  }

  async function signup(email, password, role) {
    const response = await api.auth.signup(email, password, role);
    
    // BACKEND CHECK: response.data contains { user, session }
    const result = response.data || response;
    const token = result.session?.access_token;
    const user = result.user;

    if (token && user) {
      saveSession(token, user);
      return user;
    }
    
    // If signup succeeded but session is null (e.g. waiting for email confirmation)
    if (user && !token) {
      return user; 
    }

    throw new Error(response.error || 'Signup failed');
  }

  async function logout() {
    try { await api.auth.logout(); } catch (_) {}
    clearSession();
    window.location.href = '../login.html';
  }

  // Guard: redirect to login if not authenticated
  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = '../login.html';
      return false;
    }
    return true;
  }

  // Guard: redirect if wrong role
  function requireRole(role) {
    if (!requireAuth()) return false;
    const user = getUser();
    if (user?.role !== role) {
      redirect(user?.role);
      return false;
    }
    return true;
  }

  // Guard: redirect logged-in users away from auth pages
  function requireGuest() {
    if (isLoggedIn()) {
      redirect(getRole());
      return false;
    }
    return true;
  }

  // Populate UI elements with user info
  function populateUserUI() {
    const user = getUser();
    if (!user) return;

    const nameEls   = document.querySelectorAll('[data-user-name]');
    const emailEls  = document.querySelectorAll('[data-user-email]');
    const roleEls   = document.querySelectorAll('[data-user-role]');
    const avatarEls = document.querySelectorAll('[data-user-avatar]');

    const initials = (user.email || 'U').charAt(0).toUpperCase();
    const name     = user.metadata?.name || user.email?.split('@')[0] || 'User';

    nameEls.forEach(el  => el.textContent = name);
    emailEls.forEach(el => el.textContent = user.email);
    roleEls.forEach(el  => el.textContent = user.role);
    avatarEls.forEach(el => {
      el.textContent = initials;
    });
  }

  return { 
    getToken, getUser, isLoggedIn, getRole, saveSession, clearSession,
    login, signup, logout, requireAuth, requireRole, requireGuest,
    populateUserUI, redirect 
  };
})();

window.Auth = Auth;
