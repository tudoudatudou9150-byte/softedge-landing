const fs = require("fs");
const assert = require("assert");

const script = fs.readFileSync("script.js", "utf8");

assert(
  /data-edit-request="\$\{request\.id\}"/.test(script),
  "需求池卡片编辑模式应提供修改需求入口，方便更改完整项目状态"
);

const updateRequestStatusBody = script.match(/function updateRequestStatus\(request, status\) \{([\s\S]*?)\n\}/)?.[1] || "";

assert(
  /status === "已完成"[\s\S]*(completedAt|archivedAt)/.test(updateRequestStatusBody),
  "需求状态改为已完成时应记录收录时间，便于历史库追溯"
);

console.log("request status behavior ok");
