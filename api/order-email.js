const OWNER_NOTIFICATION_EMAIL = process.env.ORDER_NOTIFICATION_EMAIL || "wjyu@hebeizhongren.com";
const OWNER_NOTIFICATION_FROM = process.env.ORDER_NOTIFICATION_FROM || "Nubohome Orders <onboarding@resend.dev>";

const escapeHtml = (value) => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const formatMoney = (value) => `$${Number(value || 0).toFixed(2)}`;

const formatPackSize = (order) => {
  const productName = String(order.product_name || "");
  if (productName.includes("Loop Fan")) {
    return `${order.pack_size} ${Number(order.pack_size) === 1 ? "fan" : "fans"}`;
  }
  return `${order.pack_size} pcs`;
};

const sendResendEmail = async ({ to, subject, html, text }) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn("Skipping owner order email: RESEND_API_KEY is not configured.");
    return { skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: OWNER_NOTIFICATION_FROM,
      to,
      subject,
      html,
      text
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || `Resend email failed: ${response.status}`);
  }

  return result;
};

const hasOwnerNotificationEvent = async (supabaseRequest, orderId) => {
  const events = await supabaseRequest(
    `order_events?order_id=eq.${encodeURIComponent(orderId)}&label=eq.Owner%20notification%20sent&select=id`
  );
  return events.length > 0;
};

const markOwnerNotificationSent = async (supabaseRequest, orderId) => {
  await supabaseRequest("order_events", {
    method: "POST",
    body: JSON.stringify({
      order_id: orderId,
      label: "Owner notification sent",
      detail: `New paid order email sent to ${OWNER_NOTIFICATION_EMAIL}.`,
      event_date: new Date().toISOString().slice(0, 10)
    })
  });
};

const buildOrderEmail = (order) => {
  const orderNumber = order.order_number || order.id || "New order";
  const subject = `New Nubohome paid order: ${orderNumber}`;
  const rows = [
    ["Order number", orderNumber],
    ["Customer", `${order.customer_name || ""} <${order.customer_email || ""}>`],
    ["Product", order.product_name],
    ["Pack size", formatPackSize(order)],
    ["Amount paid", formatMoney(order.amount_usd)],
    ["Payment status", order.payment_status],
    ["PayPal order ID", order.paypal_order_id],
    ["PayPal capture ID", order.paypal_capture_id],
    ["Shipping address", order.address_text],
    ["Created at", order.created_at]
  ];

  const htmlRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #edf0ec;color:#6b746f;font-weight:700;">${escapeHtml(label)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #edf0ec;color:#111814;">${escapeHtml(value)}</td>
    </tr>
  `).join("");

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f7f4ed;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6dfd1;">
        <div style="padding:20px 24px;background:#111814;color:#ffffff;">
          <h1 style="margin:0;font-size:22px;">New paid order</h1>
          <p style="margin:8px 0 0;color:#d8dfd8;">${escapeHtml(orderNumber)}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${htmlRows}
        </table>
        <p style="padding:16px 24px;margin:0;color:#6b746f;font-size:13px;">
          Open the Nubohome owner dashboard to add carrier and tracking details.
        </p>
      </div>
    </div>
  `;

  const text = rows.map(([label, value]) => `${label}: ${value || ""}`).join("\n");
  return { subject, html, text };
};

const notifyOwnerForPaidOrder = async ({ order, supabaseRequest }) => {
  if (!order?.id || order.payment_status !== "paid") return { skipped: true };
  if (await hasOwnerNotificationEvent(supabaseRequest, order.id)) return { skipped: true };

  const email = buildOrderEmail(order);
  await sendResendEmail({
    to: OWNER_NOTIFICATION_EMAIL,
    ...email
  });
  await markOwnerNotificationSent(supabaseRequest, order.id);
  return { sent: true };
};

module.exports = {
  notifyOwnerForPaidOrder
};
