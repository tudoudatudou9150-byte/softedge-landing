function textFromPayload(payload) {
  const title = payload.title || "未命名安排";
  const action = payload.action || "更新";
  const owners = payload.owners || "未分配";
  const day = payload.day || "未填写日期";
  const units = Number(payload.units || 0);
  const status = payload.status || "待开始";
  const note = payload.note || "无备注";

  return [
    `内容排期提醒｜${action}安排`,
    `安排内容：${title}`,
    `制作人：${owners}`,
    `安排日期：${day}`,
    `内容条数：${units} 条`,
    `当前状态：${status}`,
    `备注：${note}`,
  ].join("\n");
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const webhook = process.env.FEISHU_WEBHOOK;
  if (!webhook) {
    response.status(500).json({ ok: false, error: "Feishu webhook is not configured" });
    return;
  }

  try {
    const payload = request.body || {};
    const feishuResponse = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "text",
        content: {
          text: textFromPayload(payload),
        },
      }),
    });
    const result = await feishuResponse.json().catch(() => ({}));
    const success = result.code === 0 || result.StatusCode === 0;

    if (!feishuResponse.ok || !success) {
      response.status(502).json({ ok: false, error: result.msg || result.StatusMessage || "Feishu request failed" });
      return;
    }

    response.status(200).json({ ok: true });
  } catch (error) {
    response.status(500).json({ ok: false, error: error.message || "Unexpected error" });
  }
}
