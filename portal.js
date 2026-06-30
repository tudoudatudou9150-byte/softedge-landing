const STORE_KEY = "nubohome_portal_v2";
const SESSION_KEY = "nubohome_session_email";
const PENDING_CHECKOUT_KEY = "nubohome_pending_checkout";

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
    },
    {
      id: "NH-10011",
      orderNumber: "NH-10011",
      customerEmail: "customer@example.com",
      customerName: "Demo Customer",
      product: "Nubohome Icy Cooling Loop Fan - White",
      pack: "1 fan",
      amount: "$39.00",
      paymentStatus: "Paid",
      fulfillmentStatus: "Processing",
      carrier: "",
      trackingNumber: "",
      createdAt: "2026-06-30",
      address: "88 Sample Street, Apartment 12, Melbourne, VIC 3000, Australia",
      timeline: [
        { label: "Order paid", detail: "Payment confirmed by PayPal.", date: "2026-06-30" },
        { label: "Preparing shipment", detail: "Nubohome is preparing your order.", date: "2026-06-30" }
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

const formatPackSize = (order) => {
  const productName = String(order.product_name || order.product || "");
  if (productName.includes("Loop Fan")) {
    return `${order.pack_size || 1} ${Number(order.pack_size || 1) === 1 ? "fan" : "fans"}`;
  }
  return `${order.pack_size} pcs`;
};

const normalizeOrder = (order) => ({
  id: order.id,
  orderNumber: order.order_number || order.id,
  customerEmail: order.customer_email,
  customerName: order.customer_name,
  product: order.product_name,
  pack: formatPackSize(order),
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
    const currentPage = `${window.location.pathname.split("/").pop() || "account.html"}${window.location.search}${window.location.hash}`;
    window.location.href = `login.html?next=${encodeURIComponent(currentPage)}`;
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
    node.textContent = "";
  });
};

const setAuthMessage = (form, message, type = "info") => {
  const note = form?.querySelector("[data-auth-message]");
  if (!note) return;
  note.textContent = message;
  note.classList.remove("success-note", "error-text");
  if (type === "success") note.classList.add("success-note");
  if (type === "error") note.classList.add("error-text");
};

const setFormBusy = (form, busy, label) => {
  const button = form?.querySelector("button[type='submit']");
  if (!button) return;
  if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? label : button.dataset.defaultLabel;
};

const getAuthNextUrl = () => new URLSearchParams(window.location.search).get("next") || "account.html";

const isValidEmail = (email) => {
  const cleanEmail = String(email || "").trim();
  const atIndex = cleanEmail.indexOf("@");
  return atIndex > 0 && atIndex < cleanEmail.length - 1;
};

const validateAuthInput = (email, password) => {
  if (!isValidEmail(email)) {
    throw new Error("Please enter a valid email address.");
  }
  if (password.length < 6) {
    throw new Error("Please use a password with at least 6 characters.");
  }
};

const bindAuthSwitchLinks = () => {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next) return;

  document.querySelectorAll('a[href="login.html"], a[href="register.html"]').forEach((link) => {
    const target = link.getAttribute("href");
    link.href = `${target}?next=${encodeURIComponent(next)}`;
  });
};

const getPasswordResetRedirectUrl = () => {
  const path = window.location.pathname.replace(/[^/]*$/, "reset-password.html");
  return `${window.location.origin}${path}`;
};

const hasPasswordRecoveryToken = () => {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return params.get("type") === "recovery"
    || hashParams.get("type") === "recovery"
    || params.has("code")
    || hashParams.has("code")
    || params.has("token_hash")
    || hashParams.has("token_hash")
    || hashParams.has("access_token");
};

const showPasswordUpdateForm = () => {
  $("[data-password-reset-request]")?.classList.add("hidden");
  $("[data-password-reset-update]")?.classList.remove("hidden");
};

const getPasswordResetParam = (name) => {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return params.get(name) || hashParams.get(name) || "";
};

const clearPasswordResetUrl = () => {
  if (!window.history?.replaceState) return;
  window.history.replaceState({}, document.title, window.location.pathname);
};

const recoverPasswordSession = async () => {
  const code = getPasswordResetParam("code");
  if (code) {
    const { data, error } = await supabaseClient.auth.exchangeCodeForSession(code);
    if (!error) clearPasswordResetUrl();
    return { session: data?.session, error };
  }

  const tokenHash = getPasswordResetParam("token_hash");
  if (tokenHash) {
    const { data, error } = await supabaseClient.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash
    });
    if (!error) clearPasswordResetUrl();
    return { session: data?.session, error };
  }

  const { data, error } = await supabaseClient.auth.getSession();
  return { session: data?.session, error };
};

const bindPasswordResetForms = async () => {
  const requestForm = $("[data-password-reset-request]");
  const updateForm = $("[data-password-reset-update]");
  if (!requestForm && !updateForm) return;

  if (!isCloudMode && !isLocalPreview) {
    requestForm?.querySelector("button")?.setAttribute("disabled", "disabled");
    updateForm?.querySelector("button")?.setAttribute("disabled", "disabled");
    return;
  }

  if (hasPasswordRecoveryToken()) {
    showPasswordUpdateForm();
    if (isCloudMode) {
      setAuthMessage(updateForm, "Checking your reset link...");
      const { session, error } = await recoverPasswordSession();
      if (error || !session) {
        setAuthMessage(updateForm, "This reset link has expired. Please request a new one.", "error");
      } else {
        setAuthMessage(updateForm, "Enter a new password for your account.", "success");
      }
    }
  }

  requestForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = String(new FormData(requestForm).get("email") || "").trim().toLowerCase();

    setAuthMessage(requestForm, "");
    setFormBusy(requestForm, true, "Sending...");
    try {
      if (!isValidEmail(email)) throw new Error("Please enter a valid email address.");
      if (isCloudMode) {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: getPasswordResetRedirectUrl()
        });
        if (error) throw error;
      }
      setAuthMessage(requestForm, "If an account exists for this email, a reset link has been sent.", "success");
    } catch (error) {
      setAuthMessage(requestForm, friendlyAuthError(error), "error");
    } finally {
      setFormBusy(requestForm, false);
    }
  });

  updateForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(updateForm);
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    setAuthMessage(updateForm, "");
    setFormBusy(updateForm, true, "Saving...");
    try {
      if (password.length < 6) throw new Error("Please use a password with at least 6 characters.");
      if (password !== confirmPassword) throw new Error("The passwords do not match.");
      if (isCloudMode) {
        const { error } = await supabaseClient.auth.updateUser({ password });
        if (error) throw error;
        await supabaseClient.auth.signOut();
      }
      setAuthMessage(updateForm, "Password updated. Taking you back to sign in...", "success");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1200);
    } catch (error) {
      setAuthMessage(updateForm, friendlyAuthError(error), "error");
    } finally {
      setFormBusy(updateForm, false);
    }
  });
};

const readPendingCheckout = () => {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_CHECKOUT_KEY) || localStorage.getItem(PENDING_CHECKOUT_KEY) || "null");
  } catch {
    return null;
  }
};

const clearPendingCheckout = () => {
  sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
  localStorage.removeItem(PENDING_CHECKOUT_KEY);
};

const isCheckoutResumeUrl = (value = "") => {
  try {
    const url = new URL(value, window.location.href);
    return url.searchParams.get("checkout") === "resume";
  } catch {
    return value.includes("checkout=resume");
  }
};

const continueToPayPalCheckout = async ({ session, profile, address }) => {
  const pending = readPendingCheckout() || {};
  const allowedStyles = ["L-Shaped", "T-Shaped", "Round", "Icy Cooling Loop Fan - White", "Icy Cooling Loop Fan - Black"];
  const style = allowedStyles.includes(pending.style) ? pending.style : "L-Shaped";
  const isFan = style.startsWith("Icy Cooling Loop Fan");
  const allowedPackSizes = isFan ? [1] : [1, 4, 8, 16, 20];
  const fallbackPackSize = isFan ? 1 : 16;
  const packSize = allowedPackSizes.includes(Number(pending.packSize)) ? Number(pending.packSize) : fallbackPackSize;

  const response = await fetch("/api/create-paypal-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      style,
      packSize,
      userId: session.user.id,
      addressId: address.id,
      customerEmail: session.user.email,
      customerName: profile?.full_name || address.full_name || session.user.email
    })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not create checkout.");
  if (!result.approveUrl) throw new Error("PayPal did not return a checkout link.");
  clearPendingCheckout();
  window.location.href = result.approveUrl;
};

const friendlyAuthError = (error) => {
  const message = String(error?.message || error || "").toLowerCase();
  if (
    message.includes("rate limit")
    || message.includes("too many")
    || message.includes("security purposes")
    || message.includes("request this after")
    || message.includes("wait")
  ) {
    return "Too many reset requests. Please wait a minute, then try again with the same email.";
  }
  if (message.includes("invalid login credentials")) {
    return "The email or password is incorrect. Please check it and try again.";
  }
  if (message.includes("email or password") || message.includes("incorrect")) {
    return "The email or password is incorrect. Please check it and try again.";
  }
  if (message.includes("already registered") || message.includes("already exists") || message.includes("has already been registered")) {
    return "This email already has an account. Please use the original password or contact support.";
  }
  if (message.includes("password") && message.includes("characters")) {
    return "Please use a password with at least 6 characters.";
  }
  if (message.includes("invalid email")) {
    return "Please enter a valid email address.";
  }
  return error?.message || "Something went wrong. Please try again.";
};

const ensureCloudProfile = async (session, name = "") => {
  if (!session?.user?.id) return;
  const { error } = await supabaseClient.from("profiles").upsert({
    id: session.user.id,
    email: session.user.email,
    full_name: name || session.user.user_metadata?.full_name || session.user.email
  }, { onConflict: "id" });
  if (error) throw error;
};

const loginThroughApi = async ({ email, password, name = "" }) => {
  const response = await fetch("/api/auth-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Sign-in failed.");
  if (!result.session?.access_token || !result.session?.refresh_token) {
    throw new Error("Sign-in failed. Please try again.");
  }
  const { error } = await supabaseClient.auth.setSession({
    access_token: result.session.access_token,
    refresh_token: result.session.refresh_token
  });
  if (error) throw error;
  return result.session;
};

const registerThroughApi = async ({ email, password, name = "" }) => {
  const response = await fetch("/api/auth-register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Account creation failed.");
  if (!result.session?.access_token || !result.session?.refresh_token) {
    throw new Error("Account creation failed. Please try again.");
  }
  const { error } = await supabaseClient.auth.setSession({
    access_token: result.session.access_token,
    refresh_token: result.session.refresh_token
  });
  if (error) throw error;
  return result.session;
};

const signInCloudAccount = async ({ email, password }) => {
  const cleanEmail = String(email || "").trim().toLowerCase();

  if (window.location.protocol !== "file:") {
    return loginThroughApi({ email: cleanEmail, password });
  }

  const signInResult = await supabaseClient.auth.signInWithPassword({
    email: cleanEmail,
    password
  });

  if (!signInResult.error) {
    await ensureCloudProfile(signInResult.data.session);
    return signInResult.data.session;
  }

  throw signInResult.error;
};

const createCloudAccount = async ({ email, password, name = "" }) => {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanName = String(name || "").trim();

  if (window.location.protocol !== "file:") {
    return registerThroughApi({ email: cleanEmail, password, name: cleanName });
  }

  const signUpResult = await supabaseClient.auth.signUp({
    email: cleanEmail,
    password,
    options: { data: { full_name: cleanName } }
  });

  if (signUpResult.error) {
    throw signUpResult.error;
  }

  if (!signUpResult.data.session) {
    throw new Error("Account created, but email confirmation is required before sign-in. Please check your inbox.");
  }

  await ensureCloudProfile(signUpResult.data.session, cleanName);
  return signUpResult.data.session;
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
      const { data: savedAddress, error } = await supabaseClient
        .from("addresses")
        .upsert(payload)
        .select("*")
        .single();
      if (error) throw error;
      $("[data-form-note]").textContent = "Address saved to your account.";
      const next = new URLSearchParams(window.location.search).get("next");
      if (next && isCheckoutResumeUrl(next)) {
        $("[data-form-note]").textContent = "Address saved. Taking you to secure checkout...";
        await continueToPayPalCheckout({ session, profile, address: savedAddress });
        return;
      }
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
      const email = String(formData.get("email") || "").trim().toLowerCase();
      const password = String(formData.get("password") || "");
      const name = String(formData.get("name") || "").trim();

      setAuthMessage(registerForm, "");
      setFormBusy(registerForm, true, "Creating account...");
      try {
        validateAuthInput(email, password);
        if (isCloudMode) {
          await createCloudAccount({ email, password, name });
        } else {
          const store = readDemoStore();
          if (!store.users.some((user) => user.email === email)) {
            store.users.push({ name, email, phone: "", address: {} });
            writeDemoStore(store);
          }
          setDemoSession(email);
        }
        window.location.href = getAuthNextUrl();
      } catch (error) {
        setAuthMessage(registerForm, friendlyAuthError(error), "error");
      } finally {
        setFormBusy(registerForm, false);
      }
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
      const email = String(formData.get("email") || "").trim().toLowerCase();
      const password = String(formData.get("password") || "");

      setAuthMessage(loginForm, "");
      setFormBusy(loginForm, true, "Signing in...");
      try {
        validateAuthInput(email, password);
        if (isCloudMode) {
          await signInCloudAccount({ email, password });
        } else {
          const store = readDemoStore();
          if (!store.users.some((user) => user.email === email)) {
            store.users.push({ name: email, email, phone: "", address: {} });
            writeDemoStore(store);
          }
          setDemoSession(email);
        }
        window.location.href = getAuthNextUrl();
      } catch (error) {
        setAuthMessage(loginForm, friendlyAuthError(error), "error");
      } finally {
        setFormBusy(loginForm, false);
      }
    });
  }

  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const field = button.closest(".password-field")?.querySelector("input");
      if (!field) return;
      const shouldShow = field.type === "password";
      field.type = shouldShow ? "text" : "password";
      button.textContent = shouldShow ? "Hide" : "Show";
      button.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
    });
  });

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
      throw new Error("商家后台需要先使用管理员账号登录。");
    }
    return readDemoStore().orders;
  }
  const profile = await getCloudProfile();
  if (profile?.role !== "admin") {
    throw new Error("仅商家管理员可访问，请使用 Nubohome 管理员账号登录。");
  }
  const { data, error } = await supabaseClient
    .from("orders")
    .select("*, order_events(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(normalizeOrder);
};

const statusLabels = {
  pending: "待付款",
  paid: "已付款",
  failed: "付款失败",
  refunded: "已退款",
  processing: "处理中",
  shipped: "已发货",
  delivered: "已送达",
  cancelled: "已取消",
  Processing: "处理中",
  Shipped: "已发货",
  Delivered: "已送达",
  Refunded: "已退款",
  Paid: "已付款"
};

const statusText = (status) => statusLabels[status] || status;

const renderAnalyticsList = (items, emptyText) => {
  if (!items?.length) return `<p>${escapeHtml(emptyText)}</p>`;
  return `
    <ul>
      ${items.map((item) => `<li><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.count)}</strong></li>`).join("")}
    </ul>
  `;
};

const getOwnerAnalytics = async () => {
  if (!isCloudMode) {
    return {
      totalViews: 1286,
      last24Views: 73,
      todayViews: 41,
      uniqueVisitors: 392,
      topPages: [
        { label: "/", count: 864 },
        { label: "/#shop", count: 219 },
        { label: "/support.html", count: 43 }
      ],
      referrers: [
        { label: "Direct / unknown", count: 712 },
        { label: "google.com", count: 108 }
      ]
    };
  }

  const session = await getSession();
  if (!session?.access_token) {
    throw new Error("请先登录管理员账号后再查看后台数据。");
  }

  const response = await fetch("/api/owner-analytics", {
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "读取浏览统计失败。");
  return result;
};

const renderOwnerAnalytics = async () => {
  const root = $("[data-owner-analytics]");
  if (!root) return;

  try {
    const analytics = await getOwnerAnalytics();
    const setupNote = analytics.setupRequired
      ? `<div class="analytics-note">统计数据表还没有连接。订单功能不受影响，连接后会从新访问开始累计。</div>`
      : "";

    root.innerHTML = `
      <article>
        <span>总浏览量</span>
        <strong>${escapeHtml(analytics.totalViews)}</strong>
        <small>网站累计页面浏览</small>
      </article>
      <article>
        <span>过去 24 小时</span>
        <strong>${escapeHtml(analytics.last24Views)}</strong>
        <small>最近一天页面浏览</small>
      </article>
      <article>
        <span>今日浏览</span>
        <strong>${escapeHtml(analytics.todayViews)}</strong>
        <small>按当前自然日统计</small>
      </article>
      <article>
        <span>访客数</span>
        <strong>${escapeHtml(analytics.uniqueVisitors)}</strong>
        <small>按浏览器匿名去重</small>
      </article>
      <div class="analytics-breakdown">
        <section>
          <h2>热门页面</h2>
          ${renderAnalyticsList(analytics.topPages, "暂无页面浏览数据")}
        </section>
        <section>
          <h2>主要来源</h2>
          ${renderAnalyticsList(analytics.referrers, "暂无来源数据")}
        </section>
      </div>
      ${setupNote}
    `;
  } catch (error) {
    root.innerHTML = `<div class="analytics-note error">浏览统计暂时无法读取：${escapeHtml(error.message)}</div>`;
  }
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
      <td>${escapeHtml(statusText(order.paymentStatus))}</td>
      <td>
        <select data-admin-status="${escapeHtml(order.id)}">
          ${["processing", "shipped", "delivered", "refunded"].map((status) => `<option value="${status}" ${order.fulfillmentStatus === status || order.fulfillmentStatus === status[0].toUpperCase() + status.slice(1) ? "selected" : ""}>${statusText(status)}</option>`).join("")}
        </select>
      </td>
      <td><input data-admin-carrier="${escapeHtml(order.id)}" value="${escapeHtml(order.carrier)}" placeholder="物流商" /></td>
      <td><input data-admin-tracking="${escapeHtml(order.id)}" value="${escapeHtml(order.trackingNumber)}" placeholder="物流单号" /></td>
      <td><button class="button secondary" data-admin-save="${escapeHtml(order.id)}" type="button">保存</button></td>
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

      button.textContent = "已保存";
      setTimeout(() => { button.textContent = "保存"; }, 1200);
    });
  });
};

const bindOrderExport = () => {
  const button = $("[data-export-orders]");
  if (!button) return;
  button.addEventListener("click", async () => {
    const orders = await getAdminOrders();
    const headers = [
      "订单号",
      "客户姓名",
      "客户邮箱",
      "商品",
      "套餐",
      "金额",
      "物流商",
      "物流单号",
      "发货状态"
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
      statusText(order.fulfillmentStatus)
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
    bindAuthSwitchLinks();
    bindAuthForms();
    await bindPasswordResetForms();
    await renderAccountSummary();
    await bindAddressForm();
    await renderOrders();
    await renderTracking();
    await renderOwnerAnalytics();
    await renderAdmin();
    bindOrderExport();
  } catch (error) {
    const main = $("main") || document.body;
    const note = document.createElement("section");
    note.className = "system-note error-note";
    note.innerHTML = `<strong>需要处理</strong><span>${escapeHtml(error.message)}</span>`;
    main.prepend(note);
  }
};

initPortal();
