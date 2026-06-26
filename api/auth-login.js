const readJsonBody = (req) => new Promise((resolve, reject) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    try {
      resolve(body ? JSON.parse(body) : {});
    } catch (error) {
      reject(error);
    }
  });
  req.on("error", reject);
});

const supabaseAuthRequest = async (path, options = {}, useServiceRole = false) => {
  const key = useServiceRole ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_ANON_KEY;
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
};

const upsertProfile = async ({ userId, email, name }) => {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify({
      id: userId,
      email,
      full_name: name || email
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Profile update failed: ${message}`);
  }
};

const passwordLogin = async (email, password) => {
  const { response, result } = await supabaseAuthRequest("token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  return { ok: response.ok, status: response.status, result };
};

const createConfirmedUser = async ({ email, password, name }) => {
  const { response, result } = await supabaseAuthRequest("admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name || email }
    })
  }, true);

  return { ok: response.ok, status: response.status, result };
};

const isExistingUserError = (result) => {
  const message = String(result?.message || result?.error_description || result?.error || "").toLowerCase();
  return message.includes("already") || message.includes("registered") || message.includes("exists");
};

const getAuthErrorMessage = (result) => result?.message
  || result?.msg
  || result?.error_description
  || result?.error
  || "";

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    if (!isValidEmail(email)) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "Please use a password with at least 6 characters." });
      return;
    }

    const login = await passwordLogin(email, password);
    if (login.ok) {
      await upsertProfile({
        userId: login.result.user.id,
        email,
        name: name || login.result.user.user_metadata?.full_name
      });
      res.status(200).json({ session: login.result, created: false });
      return;
    }

    const created = await createConfirmedUser({ email, password, name });
    if (!created.ok) {
      if (isExistingUserError(created.result)) {
        res.status(401).json({ error: "The email or password is incorrect. Please check it and try again." });
        return;
      }
      res.status(created.status || 400).json({ error: getAuthErrorMessage(created.result) || "Could not create account." });
      return;
    }

    const secondLogin = await passwordLogin(email, password);
    if (!secondLogin.ok) {
      res.status(secondLogin.status || 400).json({ error: secondLogin.result.message || "Account created, but sign-in failed." });
      return;
    }

    await upsertProfile({
      userId: secondLogin.result.user.id,
      email,
      name
    });
    res.status(200).json({ session: secondLogin.result, created: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
