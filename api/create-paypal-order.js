const PAYPAL_BASE_URLS = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com"
};

const packPrices = {
  1: "7.00",
  4: "28.00",
  8: "56.00",
  16: "112.00",
  20: "140.00"
};

const shippingAndDuties = {
  1: "6.00",
  4: "6.00",
  8: "0.00",
  16: "0.00",
  20: "0.00"
};

const allowedStyles = new Set(["L-Shaped", "T-Shaped", "Round"]);

const addMoney = (left, right) => (Number(left) + Number(right)).toFixed(2);

const getPayPalBaseUrl = () => PAYPAL_BASE_URLS[process.env.PAYPAL_ENV || "sandbox"];

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

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const style = body.style;
    const packSize = Number(body.packSize);

    if (!allowedStyles.has(style) || !packPrices[packSize]) {
      res.status(400).json({ error: "Invalid product selection" });
      return;
    }

    if (!body.userId || !body.customerEmail || !body.customerName || !body.addressId) {
      res.status(400).json({ error: "Missing customer or address information" });
      return;
    }

    const orderNumber = `NH-${Date.now()}`;
    const itemAmount = packPrices[packSize];
    const shippingAmount = shippingAndDuties[packSize];
    const amount = addMoney(itemAmount, shippingAmount);
    const productName = `Nubohome ${style === "Round" ? "Round" : `${style} Rounded`} Corner Guard`;

    const createdOrders = await supabaseRequest("orders", {
      method: "POST",
      body: JSON.stringify({
        order_number: orderNumber,
        user_id: body.userId,
        address_id: body.addressId,
        customer_email: body.customerEmail,
        customer_name: body.customerName,
        product_name: productName,
        style,
        pack_size: packSize,
        amount_usd: amount,
        payment_status: "pending",
        fulfillment_status: "processing"
      })
    });

    const localOrder = createdOrders[0];
    const { access_token: accessToken } = await getPayPalAccessToken();
    const siteUrl = process.env.SITE_URL || "https://www.nubohome.net";

    const paypalResponse = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            custom_id: localOrder.id,
            invoice_id: orderNumber,
            description: `${productName} / ${packSize} pcs${Number(shippingAmount) > 0 ? " / shipping & duties included" : " / free shipping"}`,
            amount: {
              currency_code: "USD",
              value: amount,
              breakdown: {
                item_total: {
                  currency_code: "USD",
                  value: itemAmount
                },
                shipping: {
                  currency_code: "USD",
                  value: shippingAmount
                }
              }
            },
            items: [
              {
                name: productName,
                description: `${packSize} pcs`,
                quantity: "1",
                unit_amount: {
                  currency_code: "USD",
                  value: itemAmount
                }
              }
            ]
          }
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "Nubohome",
              landing_page: "NO_PREFERENCE",
              user_action: "PAY_NOW",
              return_url: `${siteUrl}/payment-return.html`,
              cancel_url: siteUrl
            }
          }
        }
      })
    });

    if (!paypalResponse.ok) {
      const message = await paypalResponse.text();
      throw new Error(`PayPal order create failed: ${paypalResponse.status} ${message}`);
    }

    const paypalOrder = await paypalResponse.json();
    await supabaseRequest(`orders?id=eq.${localOrder.id}`, {
      method: "PATCH",
      body: JSON.stringify({ paypal_order_id: paypalOrder.id })
    });

    const approveLink = paypalOrder.links.find((link) => link.rel === "payer-action" || link.rel === "approve");
    res.status(200).json({
      orderId: localOrder.id,
      orderNumber,
      paypalOrderId: paypalOrder.id,
      approveUrl: approveLink?.href
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
