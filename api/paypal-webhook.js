const PAYPAL_BASE_URLS = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com"
};

const { notifyOwnerForPaidOrder } = require("./order-email");

const getPayPalBaseUrl = () => PAYPAL_BASE_URLS[process.env.PAYPAL_ENV || "sandbox"];

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

const getPayPalAccessToken = async () => {
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!response.ok) {
    throw new Error(`PayPal access token failed: ${response.status}`);
  }

  return response.json();
};

const verifyPayPalWebhook = async (event, headers) => {
  const { access_token: accessToken } = await getPayPalAccessToken();
  const response = await fetch(`${getPayPalBaseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      auth_algo: headers["paypal-auth-algo"],
      cert_url: headers["paypal-cert-url"],
      transmission_id: headers["paypal-transmission-id"],
      transmission_sig: headers["paypal-transmission-sig"],
      transmission_time: headers["paypal-transmission-time"],
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: event
    })
  });

  if (!response.ok) {
    throw new Error(`PayPal webhook verification failed: ${response.status}`);
  }

  const result = await response.json();
  return result.verification_status === "SUCCESS";
};

const supabaseRequest = async (path, options = {}) => {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${message}`);
  }

  return response.json();
};

const getLocalOrderId = (event) => event.resource?.custom_id;

const getOrderFilter = (event) => {
  const localOrderId = getLocalOrderId(event);
  if (localOrderId) return `id=eq.${encodeURIComponent(localOrderId)}`;

  const paypalOrderId = event.resource?.supplementary_data?.related_ids?.order_id;
  if (paypalOrderId) return `paypal_order_id=eq.${encodeURIComponent(paypalOrderId)}`;

  return "";
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const event = await readJsonBody(req);
    const verified = await verifyPayPalWebhook(event, req.headers);
    if (!verified) {
      res.status(401).json({ error: "Webhook verification failed" });
      return;
    }

    const orderFilter = getOrderFilter(event);
    if (!orderFilter) {
      res.status(200).json({ received: true, ignored: "No local order id" });
      return;
    }

    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const updatedOrders = await supabaseRequest(`orders?${orderFilter}`, {
        method: "PATCH",
        body: JSON.stringify({
          payment_status: "paid",
          paypal_capture_id: event.resource?.id || ""
        })
      });

      const localOrder = updatedOrders[0];
      if (localOrder?.id) {
        await supabaseRequest("order_events", {
          method: "POST",
          body: JSON.stringify({
            order_id: localOrder.id,
            label: "Order paid",
            detail: "Payment confirmed by PayPal webhook.",
            event_date: new Date().toISOString().slice(0, 10)
          })
        });

        try {
          await notifyOwnerForPaidOrder({ order: localOrder, supabaseRequest });
        } catch (emailError) {
          console.error("Owner order notification failed:", emailError.message);
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
