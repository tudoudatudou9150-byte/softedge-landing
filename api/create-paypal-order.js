const { convertUsd, getPricingContext } = require("./currency-utils");

const PAYPAL_BASE_URLS = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com"
};

const cornerPackPrices = {
  1: "7.00",
  4: "19.00",
  8: "29.00",
  16: "39.00",
  20: "45.00"
};

const cornerShippingAndDuties = {
  1: "6.00",
  4: "6.00",
  8: "0.00",
  16: "0.00",
  20: "0.00"
};

const organizerPrices = {
  29: "24.99",
  33: "27.99",
  39: "31.99",
  41: "36.99",
  48: "39.99"
};

const organizerShippingAndDuties = {
  29: "0.00",
  33: "0.00",
  39: "0.00",
  41: "0.00",
  48: "0.00"
};

const productCatalog = {
  "L-Shaped": {
    name: "Nubohome L-Shaped Rounded Corner Guard",
    unit: "pcs",
    prices: cornerPackPrices,
    shipping: cornerShippingAndDuties
  },
  "T-Shaped": {
    name: "Nubohome T-Shaped Rounded Corner Guard",
    unit: "pcs",
    prices: cornerPackPrices,
    shipping: cornerShippingAndDuties
  },
  Round: {
    name: "Nubohome Round Corner Guard",
    unit: "pcs",
    prices: cornerPackPrices,
    shipping: cornerShippingAndDuties
  },
  "Icy Cooling Loop Fan - White": {
    name: "Nubohome Icy Cooling Loop Fan - White",
    unit: "fan",
    prices: { 1: "39.00" },
    shipping: { 1: "0.00" }
  },
  "Icy Cooling Loop Fan - Black": {
    name: "Nubohome Icy Cooling Loop Fan - Black",
    unit: "fan",
    prices: { 1: "39.00" },
    shipping: { 1: "0.00" }
  },
  "Under-Sink Pull-Out Organizer - White": {
    name: "Nubohome Under-Sink Pull-Out Organizer - White",
    unit: "cm",
    prices: organizerPrices,
    shipping: organizerShippingAndDuties
  },
  "Under-Sink Pull-Out Organizer - Black": {
    name: "Nubohome Under-Sink Pull-Out Organizer - Black",
    unit: "cm",
    prices: organizerPrices,
    shipping: organizerShippingAndDuties
  }
};

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

    const product = productCatalog[style];

    if (!product || !product.prices[packSize]) {
      res.status(400).json({ error: "Invalid product selection" });
      return;
    }

    if (!body.userId || !body.customerEmail || !body.customerName || !body.addressId) {
      res.status(400).json({ error: "Missing customer or address information" });
      return;
    }

    const orderNumber = `NH-${Date.now()}`;
    const itemAmount = product.prices[packSize];
    const shippingAmount = product.shipping[packSize];
    const amount = addMoney(itemAmount, shippingAmount);
    const pricingContext = getPricingContext(req);
    const paypalItemAmount = convertUsd(itemAmount, pricingContext);
    const paypalShippingAmount = convertUsd(shippingAmount, pricingContext);
    const paypalAmount = addMoney(paypalItemAmount, paypalShippingAmount);
    const productName = product.name;
    const unitLabel = packSize === 1 && product.unit === "fan" ? "fan" : product.unit;

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
            description: `${productName} / ${packSize} ${unitLabel}${Number(shippingAmount) > 0 ? " / shipping & duties included" : " / free shipping"}`,
            amount: {
              currency_code: pricingContext.currencyCode,
              value: paypalAmount,
              breakdown: {
                item_total: {
                  currency_code: pricingContext.currencyCode,
                  value: paypalItemAmount
                },
                shipping: {
                  currency_code: pricingContext.currencyCode,
                  value: paypalShippingAmount
                }
              }
            },
            items: [
              {
                name: productName,
                description: `${packSize} ${unitLabel}`,
                quantity: "1",
                unit_amount: {
                  currency_code: pricingContext.currencyCode,
                  value: paypalItemAmount
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
