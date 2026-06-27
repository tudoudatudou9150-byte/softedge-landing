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

const getLocalOrderId = (captureResult) => {
  const purchaseUnit = captureResult.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.[0];
  return capture?.custom_id || purchaseUnit?.custom_id;
};

const getCaptureId = (captureResult) => captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.id || "";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const paypalOrderId = body.paypalOrderId;

    if (!paypalOrderId) {
      res.status(400).json({ error: "Missing PayPal order id" });
      return;
    }

    const { access_token: accessToken } = await getPayPalAccessToken();
    const captureResponse = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    const captureResult = await captureResponse.json();
    if (!captureResponse.ok) {
      throw new Error(captureResult.message || `PayPal capture failed: ${captureResponse.status}`);
    }

    const localOrderId = getLocalOrderId(captureResult);
    const filter = localOrderId
      ? `id=eq.${encodeURIComponent(localOrderId)}`
      : `paypal_order_id=eq.${encodeURIComponent(paypalOrderId)}`;

    const updatedOrders = await supabaseRequest(`orders?${filter}`, {
      method: "PATCH",
      body: JSON.stringify({
        payment_status: "paid",
        paypal_capture_id: getCaptureId(captureResult)
      })
    });

    const localOrder = updatedOrders[0];
    if (localOrder?.id) {
      await supabaseRequest("order_events", {
        method: "POST",
        body: JSON.stringify({
          order_id: localOrder.id,
          label: "Order paid",
          detail: "Payment captured by PayPal.",
          event_date: new Date().toISOString().slice(0, 10)
        })
      });

      try {
        await notifyOwnerForPaidOrder({ order: localOrder, supabaseRequest });
      } catch (emailError) {
        console.error("Owner order notification failed:", emailError.message);
      }
    }

    res.status(200).json({
      orderId: localOrder?.id || localOrderId,
      orderNumber: localOrder?.order_number,
      status: captureResult.status || "COMPLETED"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
