const IDEA_SCHEMA = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "短唯一id, 例如 idea-001" },
          category: { type: "string", description: "创意大类, 如 情感故事 / 对比反差 / 痛点解决 / UGC生活记录 / 名人粉丝向 等" },
          title: { type: "string", description: "10-22字的中文创意标题" },
          hook: { type: "string", description: "0-3秒钩子的具体画面+台词描述" },
          logic: { type: "string", description: "为什么这个创意能转化 - 1-2句话讲底层逻辑" },
          scores: {
            type: "object",
            properties: {
              hook: { type: "number", description: "1-10" },
              conversion: { type: "number", description: "1-10" },
              feasibility: { type: "number", description: "1-10" },
            },
            required: ["hook", "conversion", "feasibility"],
            additionalProperties: false,
          },
          tags: { type: "array", items: { type: "string" } },
          script: {
            type: "array",
            items: { type: "string" },
            description: "5-8个分镜, 每条形如 '0-2s | 画面+台词'",
          },
          prompt: { type: "string", description: "可直接喂给AI视频生成的英文prompt, 含镜头/光线/风格/产品出现方式" },
        },
        required: ["id", "category", "title", "hook", "logic", "scores", "tags", "script", "prompt"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
};

function buildSystemPrompt() {
  return `你是顶级performance短视频广告创意总监, 服务过Nike/Apple/Shopee等品牌, 精通Instagram/Meta/TikTok爆款逻辑。
你的任务: 基于用户输入产出真正不同角度、可直接拍摄+可喂给AI视频生成的创意。

硬性要求:
1. 每一条创意必须有清晰的0-3秒钩子(画面+台词都要写出来),不要笼统说"展示产品"。
2. 创意之间必须真的不同 - 不同情绪/不同场景/不同人物/不同切入角度,不要换词不换内核。
3. 必须紧扣用户给的产品、市场、平台、受众,不要写通用模板。
4. logic用1-2句中文解释这条为什么能转化, 不要废话。
5. script: 5-8条分镜, 严格形如 "0-2s | 画面描述 + 台词/字幕"。
6. prompt: 一段可直接喂给AI视频生成工具的英文prompt, 包含镜头(close-up/handheld/POV)、光线、风格、产品如何出现。
7. scores: hook/conversion/feasibility 各1-10, 真实评估, 不要全打9。

只输出符合给定schema的JSON, 不要解释。`;
}

function buildUserPrompt(input) {
  const modeGuide = {
    "全域扩散": "覆盖尽可能多的不同情绪角度、不同人物视角、不同场景,横向扩散。",
    "前3秒钩子": "每一条都极度强化0-3秒钩子的视觉冲击或好奇心,标题就是钩子。",
    "转化角度": "围绕购买动机展开 - 礼物/收藏/社交身份/稀缺/对比,每条都要有清晰的购买理由。",
    "剧情变体": "都是有起承转合的微剧情, 15-30秒可拍摄, 有冲突有反转。",
  };

  return `# 产品/项目
${input.product}

# 市场
${input.market}

# 投放平台
${input.platform}

# 目标受众
${input.audience}

# 用户的初始想法
${input.idea || "(无, 完全由你发散)"}

# 脑暴模式
${input.mode} —— ${modeGuide[input.mode] || ""}

# 偏好
${input.preferences?.length ? input.preferences.join(" / ") : "无特殊偏好"}

# 数量
请生成 ${input.count} 条创意。`;
}

async function callDeepSeek(systemPrompt, userPrompt) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

  if (!apiKey) throw new Error("DEEPSEEK_API_KEY 未配置");

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_ideas",
            description: "返回创意列表",
            parameters: IDEA_SCHEMA,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_ideas" } },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    let errorCode = "";
    try {
      errorCode = JSON.parse(text)?.error?.code || "";
    } catch {
      errorCode = "";
    }
    const lowerText = text.toLowerCase();
    if (res.status === 401) throw new Error("DeepSeek API Key 无效或未配置正确");
    if (res.status === 402 || lowerText.includes("insufficient") || lowerText.includes("balance")) {
      throw new Error("DeepSeek 账户余额不足, 请先在 DeepSeek 开放平台充值");
    }
    if (res.status === 429) throw new Error("DeepSeek 请求过于频繁或额度受限, 请稍后再试");
    throw new Error(`DeepSeek 接口错误 ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("AI未返回结构化结果");

  try {
    return JSON.parse(call.function.arguments);
  } catch {
    throw new Error("AI返回的JSON无法解析");
  }
}

export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "只支持 POST 请求" });
    return;
  }

  try {
    const body = request.body || {};
    const action = body.action;
    const systemPrompt = buildSystemPrompt();
    let userPrompt = "";

    if (action === "generate") {
      userPrompt = buildUserPrompt(body.input);
    } else if (action === "expand") {
      const base = body.idea;
      const ctx = body.input;
      userPrompt = `${buildUserPrompt({ ...ctx, count: 4 })}

# 任务
围绕下面这条已有创意, 继续扩散3-5条相邻但真实不同的变体(换人物/换场景/换情绪,但保留核心钩子DNA):

标题: ${base.title}
钩子: ${base.hook}
逻辑: ${base.logic}`;
    } else if (action === "stronger_hook") {
      const base = body.idea;
      userPrompt = `请基于这条创意, 生成3个"更狠的0-3秒钩子"变体 - 同一个底层创意, 但钩子更具冲击力/更反常识/更勾人。其他字段(category/logic/script/prompt)同步调整以匹配新钩子。

原创意:
标题: ${base.title}
钩子: ${base.hook}
逻辑: ${base.logic}

产品: ${body.input?.product || ""}
受众: ${body.input?.audience || ""}`;
    } else if (action === "more_conversion") {
      const base = body.idea;
      userPrompt = `请将这条创意改写为"更强转化版本" - 强化购买动机(限量/送礼/身份/对比/恐惧损失), 让观众看完想立刻点链接。只返回1条改写后的完整创意, 但放在ideas数组里。

原创意:
标题: ${base.title}
钩子: ${base.hook}
逻辑: ${base.logic}
脚本: ${(base.script || []).join(" | ")}

产品: ${body.input?.product || ""}
受众: ${body.input?.audience || ""}`;
    } else {
      throw new Error(`未知的action: ${action}`);
    }

    response.status(200).json(await callDeepSeek(systemPrompt, userPrompt));
  } catch (error) {
    console.error("brainstorm error", error);
    response.status(500).json({ error: error.message || "AI请求失败" });
  }
}
