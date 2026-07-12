(function () {
  const key = "nubohome_visitor_id";

  const safeStorage = {
    get(name) {
      try {
        return localStorage.getItem(name);
      } catch {
        return "";
      }
    },
    set(name, value) {
      try {
        localStorage.setItem(name, value);
      } catch {
        document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=31536000; Path=/; SameSite=Lax`;
      }
    }
  };

  const readCookie = (name) => {
    const encodedName = `${encodeURIComponent(name)}=`;
    const rawValue = document.cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(encodedName))
      ?.slice(encodedName.length) || "";
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return "";
    }
  };

  const getVisitorId = () => {
    const existing = safeStorage.get(key) || readCookie(key);
    if (existing) return existing;

    const id = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    safeStorage.set(key, id);
    return id;
  };

  const payload = {
    visitorId: getVisitorId(),
    path: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    referrer: document.referrer || ""
  };

  const body = JSON.stringify(payload);
  const blob = new Blob([body], { type: "application/json" });

  if (navigator.sendBeacon && navigator.sendBeacon("/api/track-view", blob)) return;

  fetch("/api/track-view", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true
  }).catch(() => {});
}());
