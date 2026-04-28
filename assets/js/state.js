// ============================================================
// PLEXI DIGITAL MALL — State Manager
// ============================================================

const State = (() => {
  const _state = {
    user: null,
    notifications: [],
    cartCount: 0,
    currentStore: null,
    currentProduct: null,
    filters: {
      category: 'all',
      search: '',
      sort: 'newest'
    }
  };

  const _listeners = {};

  function get(key) {
    return key ? _state[key] : { ..._state };
  }

  function set(key, value) {
    const old = _state[key];
    _state[key] = value;
    if (_listeners[key]) {
      _listeners[key].forEach(fn => fn(value, old));
    }
  }

  function subscribe(key, fn) {
    if (!_listeners[key]) _listeners[key] = [];
    _listeners[key].push(fn);
    return () => {
      _listeners[key] = _listeners[key].filter(f => f !== fn);
    };
  }

  function init() {
    const user = Auth.getUser();
    if (user) set('user', user);
  }

  return { get, set, subscribe, init };
})();

window.State = State;