(function () {
  const key = "nubohome_visitor_id";

  const getVisitorId = () => {
    const existing = localStorage.getItem(key);
    if (existing) return existing;

    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, id);
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
