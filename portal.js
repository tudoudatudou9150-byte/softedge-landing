const STORE_KEY = "nubohome_portal_v2";
const SESSION_KEY = "nubohome_session_email";

const config = window.NUBOHOME_SUPABASE || {};
const supabaseClient = window.supabase && config.url && config.anonKey
  ? window.supabase.createClient(config.url, config.anonKey)
  : null;
const isCloudMode = Boolean(supabaseClient);
const isLocalPreview = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);

const demoStore = {
  users: [
    {
      name: "Demo Customer",
      email: "customer@example.com",
      phone: "+61 400 000 000",
      address: {
        fullName: "Demo Customer",
        phone: "+61 400 000 000",
        country: "Australia",
        region: "VIC",
        city: "Melbourne",
        postalCode: "3000",
        addressLine1: "88 Sample Street",
        addressLine2: "Apartment 12"
      }
    }
  ],
  orders: [
    {
      id: "NH-10027",
      orderNumber: "NH-10027",
      customerEmail: "customer@example.com",
      customerName: "Demo Customer",
      product: "Nubohome L-Shaped Rounded Corner Guard",
      pack: "16 pcs",
      amount: "$112.00",
      paymentStatus: "Paid",
      fulfillmentStatus: "Processing",
      carrier: "",
      trackingNumber: "",
      createdAt: "2026-06-26",
      address: "88 Sample Street, Apartment 12, Melbourne, VIC 3000, Australia",
      timeline: [
        { label: "Order paid", detail: "Payment confirmed by PayPal.", date: "2026-06-26" },
        { label: "Preparing shipment", detail: "Nubohome is preparing your order.", date: "2026-06-26" }
      ]
    },
    {
      id: "NH-10018",
      orderNumber: "NH-10018",
      customerEmail: "customer@example.com",
      customerName: "Demo Customer",
      product: "Nubohome T-Shaped Rounded Corner Guard",
      pack: "8 pcs",
      amount: "$56.00",
      paymentStatus: "Paid",
      fulfillmentStatus: "Shipped",
      carrier: "USPS",
      trackingNumber: "9400 1000 0000 0000 0000 00",
      createdAt: "2026-06-21",
      address: "88 Sample Street, Apartment 12, Melbourne, VIC 3000, Australia",
      timeline: [
        { label: "Order paid", detail: "Payment confirmed by PayPal.", date: "2026-06-21" },
        { label: "Shipped", detail: "Tracking number added by Nubohome.", date: "2026-06-22" },
        { label: "In transit", detail: "Package is moving through the carrier network.", date: "2026-06-24" }
      ]
    }
  ]
};

const $ = (selector) => document.querySelector(selector);

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const readDemoStore = () => {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) {
    localStorage.setItem(STORE_KEY, JSON.stringify(demoStore));
    return structuredClone(demoStore);
  }
  return JSON.parse(raw);
};

const writeDemoStore = (store) => {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
};

const setDemoSession = (email) => {
  localStorage.setItem(SESSION_KEY, email);
};

const getDemoUser = () => {
  const store = readDemoStore();
  const email = localStorage.getItem(SESSION_KEY) || "customer@example.com";
  return store.users.find((user) => user.email === email) || store.users[0];
};

const getSession = async () => {
  if (!isCloudMode) return null;
  const { data } = await supabaseClient.auth.getSession();
  return data.session;
};

const getCloudProfile = async () => {
  const session = await getSession();
  if (!session) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data || {
    id: session.user.id,
    email: session.user.email,
    full_name: session.user.user_metadata?.full_name || "",
    phone: "",
    role: "customer"
  };
};

const formatAddress = (address) => {
  if (!address) return "No shipping address saved yet.";
  return [
    address.address_line_1 || address.addressLine1,
    address.address_line_2 || address.addressLine2,
    address.city,
    address.region || address.state,
    address.postal_code || address.postalCode,
    address.country
  ].filter(Boolean).join(", ");
};

const normalizeOrder = (order) => ({
  id: order.id,
  orderNumber: order.order_number || order.id,
  customerEmail: order.customer_email,
  customerName: order.customer_name,
  product: order.product_name,
  pack: `${order.pack_size} pcs`,
  amount: `$${Number(order.amount_usd || 0).toFixed(2)}`,
  paymentStatus: order.payment_status,
  fulfillmentStatus: order.fulfillment_status,
  carrier: order.carrier || "",
  trackingNumber: order.tracking_number || "",
  createdAt: (order.created_at || "").slice(0, 10),
  address: order.address_text || "",
  timeline: (order.order_events || []).map((event) => ({
    label: event.label,
    detail: event.detail,
    date: event.event_date || (event.created_at || "").slice(0, 10)
  }))
});

const requireCloudLogin = async () => {
  const session = await getSession();
  if (!session) {
    window.location.href = `login.html?next=${encodeURIComponent(window.location.pathname.split("/").pop() || "account.html")}`;
    return null;
  }
  return session;
};

const renderUnavailable = (root, title = "Account system is being connected") => {
  if (!root) return;
  root.innerHTML = `
    <article class="portal-card">
      <span class="portal-kicker">Nubohome account</span>
      <h2>${escapeHtml(title)}</h2>
      <p>Please contact support if you need help with an order while we finish connecting secure account access.</p>
      <a class="text-link" href="support.html">Contact support</a>
    </article>
  `;
};

const getCustomerOrders = async () => {
  if (!isCloudMode) {
    if (!isLocalPreview) return [];
    const user = getDemoUser();
    return readDemoStore().orders.filter((order) => order.customerEmail === user.email);
  }

  const session = await requireCloudLogin();
  if (!session) return [];
  const { data, error } = await supabaseClient
    .from("orders")
    .select("*, order_events(*)")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data.map(normalizeOrder);
};

const getOrderFromUrl = async () => {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("order");
  const orders = await getCustomerOrders();
  return orders.find((order) => order.id === requested || order.orderNumber === requested) || orders[0];
};

const renderSystemMode = () => {
  const nodes = document.querySelectorAll("[data-system-mode]");
  nodes.forEach((node) => {
    node.textContent = isCloudMode
      ? "Connected to Supabase. Customer data is saved securely after sign-in."
      : isLocalPreview
        ? "Preview mode. Add the Supabase public key to switch this page to real accounts."
        : "Secure account access is being connected.";
  });
};

const renderAccountSummary = async () => {
  const root = $("[data-account-summary]");
  if (!root) return;

  if (!isCloudMode && !isLocalPreview) {
    renderUnavailable(root);
    return;
  }

  if (isCloudMode) {
    const session = await requireCloudLogin();
    if (!session) return;
    const profile = await getCloudProfile();
    const { data: address } = await supabaseClient
      .from("addresses")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("is_default", true)
      .maybeSingle();
    const orders = await getCustomerOrders();

    root.innerHTML = `
      <article class="portal-card">
        <span class="portal-kicker">Signed in as</span>
        <h2>${escapeHtml(profile.full_name || profile.email)}</h2>
        <p>${escapeHtml(profile.email)}</p>
        <p>${escapeHtml(profile.phone || "No phone number saved")}</p>
      </article>
      <article class="portal-card">
        <span class="portal-kicker">Default shipping address</span>
        <h2>${escapeHtml(address?.full_name || profile.full_name || "No address yet")}</h2>
        <p>${escapeHtml(formatAddress(address))}</p>
        <a class="text-link" href="address.html">Edit address</a>
      </article>
      <article class="portal-card">
        <span class="portal-kicker">Orders</span>
        <h2>${orders.length} order${orders.length === 1 ? "" : "s"}</h2>
        <p>Track paid orders and shipment progress from your account.</p>
        <a class="text-link" href="orders.html">View orders</a>
      </article>
    `;
    return;
  }

  const user = getDemoUser();
  const orders = readDemoStore().orders.filter((order) => order.customerEmail === user.email);
  root.innerHTML = `
    <article class="portal-card">
      <span class="portal-kicker">Signed in as</span>
      <h2>${escapeHtml(user.name)}</h2>
      <p>${escapeHtml(user.email)}</p>
      <p>${escapeHtml(user.phone || "No phone number saved")}</p>
    </article>
    <article class="portal-card">
      <span class="portal-kicker">Default shipping address</span>
      <h2>${escapeHtml(user.address?.fullName || user.name)}</h2>
      <p>${escapeHtml(formatAddress(user.address))}</p>
      <a class="text-link" href="address.html">Edit address</a>
    </article>
    <article class="portal-card">
      <span class="portal-kicker">Orders</span>
      <h2>${orders.length} order${orders.length === 1 ? "" : "s"}</h2>
      <p>Track paid orders and shipment progress from your account.</p>
      <a class="text-link" href="orders.html">View orders</a>
    </article>
  `;
};

const bindAddressForm = async () => {
  const form = $("[data-address-form]");
  if (!form) return;

  if (!isCloudMode && !isLocalPreview) {
    form.innerHTML = `
      <p class="form-note">Secure address saving is being connected. Please contact support for order help.</p>
      <a class="button secondary" href="support.html">Contact support</a>
    `;
    return;
  }

  if (isCloudMode) {
    const session = await requireCloudLogin();
    if (!session) return;
    const profile = await getCloudProfile();
    const { data: address } = await supabaseClient
      .from("addresses")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("is_default", true)
      .maybeSingle();

    const values = {
      fullName: address?.full_name || profile?.full_name || "",
      phone: address?.phone || profile?.phone || "",
      country: address?.country || "",
      state: address?.region || "",
      city: address?.city || "",
      postalCode: address?.postal_code || "",
      addressLine1: address?.address_line_1 || "",
      addressLine2: address?.address_line_2 || ""
    };
    Object.entries(values).forEach(([name, value]) => {
      const field = form.querySelector(`[name="${name}"]`);
      if (field) field.value = value;
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const payload = {
        id: address?.id,
        user_id: session.user.id,
        full_name: formData.get("fullName"),
        phone: formData.get("phone"),
        country: formData.get("country"),
        region: formData.get("state"),
        city: formData.get("city"),
        postal_code: formData.get("postalCode"),
        address_line_1: formData.get("addressLine1"),
        address_line_2: formData.get("addressLine2"),
        is_default: true
      };
      const { error } = await supabaseClient.from("addresses").upsert(payload);
      if (error) throw error;
      $("[data-form-note]").textContent = "Address saved to your account.";
      const next = new URLSearchParams(window.location.search).get("next");
      if (next) window.location.href = next;
    });
    return;
  }

  const user = getDemoUser();
  const address = user.address || {};
  Object.entries({
    fullName: address.fullName || user.name,
    phone: address.phone || user.phone || "",
    country: address.country || "",
    state: address.region || address.state || "",
    city: address.city || "",
    postalCode: address.postalCode || "",
    addressLine1: address.addressLine1 || "",
    addressLine2: address.addressLine2 || ""
  }).forEach(([name, value]) => {
    const field = form.querySelector(`[name="${name}"]`);
    if (field) field.value = value;
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const store = readDemoStore();
    const index = store.users.findIndex((item) => item.email === user.email);
    store.users[index].phone = formData.get("phone");
    store.users[index].address = {
      fullName: formData.get("fullName"),
      phone: formData.get("phone"),
      country: formData.get("country"),
      region: formData.get("state"),
      city: formData.get("city"),
      postalCode: formData.get("postalCode"),
      addressLine1: formData.get("addressLine1"),
      addressLine2: formData.get("addressLine2")
    };
    writeDemoStore(store);
    $("[data-form-note]").textContent = "Address saved in preview mode.";
    const next = new URLSearchParams(window.location.search).get("next");
    if (next) window.location.href = next;
  });
};

const renderOrders = async () => {
  const root = $("[data-orders]");
  if (!root) return;
  if (!isCloudMode && !isLocalPreview) {
    renderUnavailable(root, "Order history is being connected");
    return;
  }
  const orders = await getCustomerOrders();
  if (!orders.length) {
    root.innerHTML = `<article class="portal-card"><h2>No orders yet</h2><p>Paid orders will appear here after checkout.</p></article>`;
    return;
  }
  root.innerHTML = orders.map((order) => `
    <article class="order-card">
      <div>
        <span class="portal-kicker">${escapeHtml(order.orderNumber)}</span>
        <h2>${escapeHtml(order.product)}</h2>
        <p>${escapeHtml(order.pack)} · ${escapeHtml(order.amount)} · ${escapeHtml(order.createdAt)}</p>
      </div>
      <div class="status-stack">
        <span>${escapeHtml(order.paymentStatus)}</span>
        <strong>${escapeHtml(order.fulfillmentStatus)}</strong>
      </div>
      <a class="button secondary" href="tracking.html?order=${encodeURIComponent(order.id)}">Track order</a>
    </article>
  `).join("");
};

const renderTracking = async () => {
  const root = $("[data-tracking]");
  if (!root) return;
  if (!isCloudMode && !isLocalPreview) {
    renderUnavailable(root, "Shipment tracking is being connected");
    return;
  }
  const order = await getOrderFromUrl();
  if (!order) {
    root.innerHTML = `<article class="portal-card"><h2>No order found</h2><p>Please sign in and check your order list.</p></article>`;
    return;
  }

  const timeline = order.timeline.length ? order.timeline : [
    { date: order.createdAt || new Date().toISOString().slice(0, 10), label: "Order received", detail: "Your order is being prepared." }
  ];

  root.innerHTML = `
    <article class="tracking-head">
      <div>
        <span class="portal-kicker">${escapeHtml(order.orderNumber)}</span>
        <h2>${escapeHtml(order.fulfillmentStatus)}</h2>
        <p>${escapeHtml(order.product)} · ${escapeHtml(order.pack)}</p>
      </div>
      <div class="tracking-number">
        <span>${escapeHtml(order.carrier || "Carrier not added yet")}</span>
        <strong>${escapeHtml(order.trackingNumber || "Tracking number pending")}</strong>
      </div>
    </article>
    <div class="timeline">
      ${timeline.map((event) => `
        <article>
          <span>${escapeHtml(event.date)}</span>
          <h3>${escapeHtml(event.label)}</h3>
          <p>${escapeHtml(event.detail)}</p>
        </article>
      `).join("")}
    </div>
  `;
};

const bindAuthForms = () => {
  const registerForm = $("[data-register-form]");
  if (registerForm) {
    if (!isCloudMode && !isLocalPreview) {
      registerForm.querySelector("button")?.setAttribute("disabled", "disabled");
      return;
    }
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(registerForm);
      const email = formData.get("email");
      const password = formData.get("password");
      const name = formData.get("name");

      if (isCloudMode) {
        const { error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } }
        });
        if (error) throw error;
      } else {
        const store = readDemoStore();
        if (!store.users.some((user) => user.email === email)) {
          store.users.push({ name, email, phone: "", address: {} });
          writeDemoStore(store);
        }
        setDemoSession(email);
      }
      window.location.href = "account.html";
    });
  }

  const loginForm = $("[data-login-form]");
  if (loginForm) {
    if (!isCloudMode && !isLocalPreview) {
      loginForm.querySelector("button")?.setAttribute("disabled", "disabled");
      return;
    }
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(loginForm);
      const email = formData.get("email");
      const password = formData.get("password");
      if (isCloudMode) {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        setDemoSession(email);
      }
      const next = new URLSearchParams(window.location.search).get("next") || "account.html";
      window.location.href = next;
    });
  }

  const logoutButton = $("[data-logout]");
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      if (isCloudMode) await supabaseClient.auth.signOut();
      localStorage.removeItem(SESSION_KEY);
      window.location.href = "login.html";
    });
  }
};

const getAdminOrders = async () => {
  if (!isCloudMode) {
    if (!isLocalPreview) {
      throw new Error("Owner dashboard requires Supabase admin login before it can be used online.");
    }
    return readDemoStore().orders;
  }
  const profile = await getCloudProfile();
  if (profile?.role !== "admin") {
    throw new Error("Owner access only. Please sign in with the Nubohome admin account.");
  }
  const { data, error } = await supabaseClient
    .from("orders")
    .select("*, order_events(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(normalizeOrder);
};

const renderAdmin = async () => {
  const tbody = $("[data-admin-orders]");
  if (!tbody) return;
  const orders = await getAdminOrders();
  tbody.innerHTML = orders.map((order) => `
    <tr>
      <td><strong>${escapeHtml(order.orderNumber)}</strong><span>${escapeHtml(order.createdAt)}</span></td>
      <td>${escapeHtml(order.customerName)}<span>${escapeHtml(order.customerEmail)}</span></td>
      <td>${escapeHtml(order.product)}<span>${escapeHtml(order.pack)} · ${escapeHtml(order.amount)}</span></td>
      <td>${escapeHtml(order.paymentStatus)}</td>
      <td>
        <select data-admin-status="${escapeHtml(order.id)}">
          ${["processing", "shipped", "delivered", "refunded"].map((status) => `<option value="${status}" ${order.fulfillmentStatus === status || order.fulfillmentStatus === status[0].toUpperCase() + status.slice(1) ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </td>
      <td><input data-admin-carrier="${escapeHtml(order.id)}" value="${escapeHtml(order.carrier)}" placeholder="Carrier" /></td>
      <td><input data-admin-tracking="${escapeHtml(order.id)}" value="${escapeHtml(order.trackingNumber)}" placeholder="Tracking number" /></td>
      <td><button class="button secondary" data-admin-save="${escapeHtml(order.id)}" type="button">Save</button></td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-admin-save]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.adminSave;
      const status = tbody.querySelector(`[data-admin-status="${id}"]`).value;
      const carrier = tbody.querySelector(`[data-admin-carrier="${id}"]`).value;
      const trackingNumber = tbody.querySelector(`[data-admin-tracking="${id}"]`).value;

      if (isCloudMode) {
        const { error } = await supabaseClient
          .from("orders")
          .update({
            fulfillment_status: status,
            carrier,
            tracking_number: trackingNumber
          })
          .eq("id", id);
        if (error) throw error;

        if (status === "shipped") {
          await supabaseClient.from("order_events").insert({
            order_id: id,
            label: "Shipped",
            detail: `Tracking number ${trackingNumber || "pending"} added by Nubohome.`,
            event_date: new Date().toISOString().slice(0, 10)
          });
        }
      } else {
        const store = readDemoStore();
        const order = store.orders.find((item) => item.id === id);
        order.fulfillmentStatus = status[0].toUpperCase() + status.slice(1);
        order.carrier = carrier;
        order.trackingNumber = trackingNumber;
        if (status === "shipped" && !order.timeline.some((item) => item.label === "Shipped")) {
          order.timeline.push({
            label: "Shipped",
            detail: `Tracking number ${trackingNumber || "pending"} added by Nubohome.`,
            date: new Date().toISOString().slice(0, 10)
          });
        }
        writeDemoStore(store);
      }

      button.textContent = "Saved";
      setTimeout(() => { button.textContent = "Save"; }, 1200);
    });
  });
};

const bindOrderExport = () => {
  const button = $("[data-export-orders]");
  if (!button) return;
  button.addEventListener("click", async () => {
    const orders = await getAdminOrders();
    const headers = [
      "Order Number",
      "Customer Name",
      "Customer Email",
      "Product",
      "Pack Size",
      "Amount",
      "Carrier",
      "Tracking Number",
      "Fulfillment Status"
    ];
    const rows = orders.map((order) => [
      order.orderNumber,
      order.customerName,
      order.customerEmail,
      order.product,
      order.pack,
      order.amount,
      order.carrier,
      order.trackingNumber,
      order.fulfillmentStatus
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value || "").replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nubohome-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });
};

const initPortal = async () => {
  try {
    renderSystemMode();
    bindAuthForms();
    await renderAccountSummary();
    await bindAddressForm();
    await renderOrders();
    await renderTracking();
    await renderAdmin();
    bindOrderExport();
  } catch (error) {
    const main = $("main") || document.body;
    const note = document.createElement("section");
    note.className = "system-note error-note";
    note.innerHTML = `<strong>Something needs attention</strong><span>${escapeHtml(error.message)}</span>`;
    main.prepend(note);
  }
};

initPortal();
