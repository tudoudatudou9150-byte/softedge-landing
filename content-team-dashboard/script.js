const STORAGE_KEY = "content-team-dashboard-preview";
const EDIT_PASSWORD = "content2026";
const DATA_VERSION = 8;

const defaultState = {
  version: DATA_VERSION,
  week: {
    type: "small",
    workdays: 6,
    dailyStandard: 4,
    updatedAt: "2026-06-22 20:20",
  },
  members: [
    { id: "m1", name: "王敬文" },
    { id: "m2", name: "朱耀赞" },
    { id: "m3", name: "张学辉" },
    { id: "m4", name: "赖锐捷" },
  ],
  events: [
    { id: "e1", memberId: "m2", day: 2, type: "全天拍摄", units: 4, note: "新品口播与场景视频拍摄" },
    { id: "e2", memberId: "m4", day: 2, type: "全天拍摄", units: 4, note: "协同拍摄与现场统筹" },
    { id: "e3", memberId: "m1", day: 3, type: "重点会议", units: 1, note: "视频选题评审会" },
    { id: "e4", memberId: "m3", day: 4, type: "半天拍摄", units: 2, note: "补拍产品细节镜头" },
  ],
  projects: [
    {
      id: "p1",
      name: "本周新品短视频脚本",
      type: "视频脚本",
      ownerId: "m1",
      units: 10,
      status: "进行中",
      due: "周三",
      priority: "高",
      risk: "等待产品卖点确认",
    },
    {
      id: "p2",
      name: "新品短视频脚本与剪辑",
      type: "短视频",
      ownerId: "m2",
      units: 14,
      status: "待反馈",
      due: "周五",
      priority: "高",
      risk: "脚本已出，等待品牌确认",
    },
    {
      id: "p3",
      name: "达人混剪视频批量产出",
      type: "混剪",
      ownerId: "m3",
      units: 12,
      status: "待开始",
      due: "周五",
      priority: "中",
      risk: "素材包待补齐",
    },
    {
      id: "p4",
      name: "直播切片短视频包装",
      type: "切片剪辑",
      ownerId: "m4",
      units: 10,
      status: "进行中",
      due: "周五",
      priority: "高",
      risk: "素材量大，后期占用较多",
    },
  ],
  requests: [
    {
      id: "r1",
      name: "刘智荣官网皮革需求",
      requester: "刘智荣",
      requestTopic: "皮革",
      type: "轻量视频",
      channel: "官网",
      assigneeId: "m1",
      units: 4,
      due: "周五",
      docUrl: "https://example.com/channel-video-brief",
      urgency: "普通",
      status: "已接收",
      note: "可插入本周剩余产能",
    },
    {
      id: "r2",
      name: "陈思远亚马逊开箱需求",
      requester: "陈思远",
      requestTopic: "开箱",
      type: "新拍摄",
      channel: "亚马逊",
      assigneeId: "m2",
      units: 8,
      due: "本周",
      docUrl: "https://example.com/unboxing-video-brief",
      urgency: "紧急",
      status: "排到下周",
      note: "本周拍摄产能不足",
    },
  ],
};

let state = loadState();
let editing = false;
let activeEntryType = "";
let activeEntryDefaults = {};
let pendingQuickAdjust = false;

const dayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const selectors = {
  body: document.body,
  modePill: document.querySelector("#mode-pill"),
  editToggle: document.querySelector("#edit-toggle"),
  quickAdjust: document.querySelector("#quick-adjust"),
  resetDemo: document.querySelector("#reset-demo"),
  statusTitle: document.querySelector("#status-title"),
  statusCopy: document.querySelector("#status-copy"),
  capacityProgress: document.querySelector("#capacity-progress"),
  metricGrid: document.querySelector("#metric-grid"),
  scheduleTable: document.querySelector("#schedule-table"),
  projectTable: document.querySelector("#project-table"),
  requestList: document.querySelector("#request-list"),
  eventGrid: document.querySelector("#event-grid"),
  weekType: document.querySelector("#week-type"),
  workdays: document.querySelector("#workdays"),
  dailyStandard: document.querySelector("#daily-standard"),
  saveWeek: document.querySelector("#save-week"),
  addProject: document.querySelector("#add-project"),
  addRequest: document.querySelector("#add-request"),
  addEvent: document.querySelector("#add-event"),
  passwordDialog: document.querySelector("#password-dialog"),
  passwordInput: document.querySelector("#edit-password"),
  passwordError: document.querySelector("#password-error"),
  confirmPassword: document.querySelector("#confirm-password"),
  entryDialog: document.querySelector("#entry-dialog"),
  entryKicker: document.querySelector("#entry-kicker"),
  entryTitle: document.querySelector("#entry-title"),
  entryFields: document.querySelector("#entry-fields"),
  saveEntry: document.querySelector("#save-entry"),
  quickDialog: document.querySelector("#quick-dialog"),
  quickWeekType: document.querySelector("#quick-week-type"),
  quickWorkdays: document.querySelector("#quick-workdays"),
  quickDailyStandard: document.querySelector("#quick-daily-standard"),
  quickWeekNote: document.querySelector("#quick-week-note"),
  quickEventFields: document.querySelector("#quick-event-fields"),
  quickSaveWeek: document.querySelector("#quick-save-week"),
  quickSaveAll: document.querySelector("#quick-save-all"),
  toast: document.querySelector("#toast"),
};

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return structuredClone(defaultState);

  try {
    const parsed = JSON.parse(stored);
    return parsed.version === DATA_VERSION ? parsed : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  state.week.updatedAt = new Date().toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function memberName(id) {
  return state.members.find((member) => member.id === id)?.name || "未分配";
}

function requestStatusToProjectStatus(status) {
  const statusMap = {
    已接收: "待开始",
    排期中: "进行中",
    已完成: "已完成",
  };

  return statusMap[status] || "待评估";
}

function isRequestScheduled(request) {
  return ["已接收", "排期中", "已完成"].includes(request.status);
}

function getScheduledItems() {
  const manualProjects = state.projects.map((project) => ({
    ...project,
    source: "手动项目",
  }));
  const syncedRequests = state.requests.filter(isRequestScheduled).map((request) => ({
    id: `request-${request.id}`,
    name: request.name,
    type: `${request.channel || "未选择渠道"} · ${request.type}`,
    ownerId: request.assigneeId,
    units: request.units,
    status: requestStatusToProjectStatus(request.status),
    due: request.due,
    priority: request.urgency === "紧急" ? "高" : "中",
    risk: request.note || "来自需求池自动同步",
    source: "需求池同步",
  }));

  return [...manualProjects, ...syncedRequests];
}

function projectUnitsByMember(memberId) {
  return getScheduledItems()
    .filter((project) => project.ownerId === memberId)
    .reduce((total, project) => total + Number(project.units || 0), 0);
}

function eventUnitsByMemberDay(memberId, day) {
  return state.events
    .filter((event) => event.memberId === memberId && Number(event.day) === day)
    .reduce((total, event) => total + Number(event.units || 0), 0);
}

function eventNotes(memberId, day) {
  return state.events
    .filter((event) => event.memberId === memberId && Number(event.day) === day)
    .map((event) => `${event.type} -${event.units}：${event.note}`)
    .join("；");
}

function getCapacity() {
  const theoretical = state.members.length * state.week.workdays * state.week.dailyStandard;
  const eventDeduction = state.events.reduce((total, event) => total + Number(event.units || 0), 0);
  const scheduled = getScheduledItems().reduce((total, project) => total + Number(project.units || 0), 0);
  const remaining = theoretical - eventDeduction - scheduled;
  const risky = getScheduledItems().some((project) => project.status === "阻塞" || project.risk.includes("占用"));
  let status = "可接";
  let statusClass = "status-good";

  if (remaining <= 0) {
    status = "已满";
    statusClass = "status-full";
  } else if (remaining < 10) {
    status = "偏紧";
    statusClass = "status-tight";
  }

  if (risky) {
    status = status === "已满" ? "已满且有风险" : `${status}，有风险`;
  }

  return { theoretical, eventDeduction, scheduled, remaining, risky, status, statusClass };
}

function render() {
  renderWeekEditor();
  renderHero();
  renderMetrics();
  renderSchedule();
  renderProjects();
  renderRequests();
  renderEvents();
}

function renderWeekEditor() {
  selectors.weekType.value = state.week.type;
  selectors.workdays.value = state.week.workdays;
  selectors.dailyStandard.value = state.week.dailyStandard;
}

function renderHero() {
  const capacity = getCapacity();
  const remainingText = capacity.remaining > 0 ? `还可接约 ${capacity.remaining} 条视频需求` : "本周暂无可接视频产能";
  const weekLabel = state.week.type === "big" ? "大周（工作5天，休息2天）" : "小周（工作6天，休息1天）";
  const used = Math.max(capacity.eventDeduction + capacity.scheduled, 0);
  const remaining = Math.max(capacity.remaining, 0);
  const usedPercent = capacity.theoretical > 0 ? Math.min((used / capacity.theoretical) * 100, 100) : 0;
  const remainingPercent = capacity.theoretical > 0 ? Math.max(100 - usedPercent, 0) : 0;

  selectors.statusTitle.textContent = "本周视频需求承接进度";
  selectors.statusCopy.textContent = `本周为${weekLabel}，共 ${state.week.workdays} 个工作日。内容产出周期会随素材存量、拍摄难度、天气情况等因素变动，具体达成情况需由内容组评估；非紧急需求建议提前半个月提交。`;
  selectors.capacityProgress.innerHTML = `
    <div class="progress-head">
      <span>理论产能 ${capacity.theoretical} 条</span>
      <strong>${remainingText}</strong>
    </div>
    <div class="progress-track" aria-label="本周产能使用进度">
      <div class="progress-used" style="width: ${usedPercent}%"></div>
      <div class="progress-remaining" style="width: ${remainingPercent}%"></div>
    </div>
    <div class="progress-legend">
      <span><i class="legend-used"></i>已占用 ${used} 条</span>
      <span><i class="legend-remaining"></i>剩余 ${remaining} 条</span>
      <span><i class="legend-warning"></i>其中拍摄/会议/请假扣减 ${capacity.eventDeduction} 条</span>
    </div>
  `;
}

function renderMetrics() {
  const capacity = getCapacity();
  const weekLabel = state.week.type === "big" ? "大周" : "小周";
  const restDays = Math.max(7 - Number(state.week.workdays || 0), 0);
  const metrics = [
    ["大小周", weekLabel, `工作 ${state.week.workdays} 天，休息 ${restDays} 天`],
    ["理论产能", capacity.theoretical, `${state.members.length} 人 × ${state.week.workdays} 天 × ${state.week.dailyStandard} 条`],
    ["占用扣减", capacity.eventDeduction, "拍摄 / 会议 / 请假"],
    ["已排任务", capacity.scheduled, "已排内容合计"],
    ["剩余可接", capacity.remaining, capacity.remaining > 0 ? "可进入需求池评估" : "需要重新排期"],
  ];

  selectors.metricGrid.innerHTML = metrics
    .map(
      ([label, value, hint]) => `
        <article class="metric-card">
          <p class="eyebrow">${label}</p>
          <strong>${value}</strong>
          <small>${hint}</small>
        </article>
      `
    )
    .join("");
}

function renderSchedule() {
  const days = dayLabels.slice(0, state.week.workdays);
  const head = `<thead><tr><th>成员</th>${days.map((day) => `<th>${day}</th>`).join("")}</tr></thead>`;
  const rows = state.members
    .map((member) => {
      const memberProjects = projectUnitsByMember(member.id);
      const dailyProjectShare = Math.ceil(memberProjects / state.week.workdays);
      const cells = days
        .map((_, index) => {
          const day = index + 1;
          const eventUnits = eventUnitsByMemberDay(member.id, day);
          const remaining = Math.max(state.week.dailyStandard - eventUnits - dailyProjectShare, 0);
          const notes = eventNotes(member.id, day) || "无特殊占用";
          return `
            <td class="schedule-cell">
              <div class="cell-main">
                <span>余 ${remaining} 条</span>
                <span class="status-tag ${remaining > 1 ? "status-good" : remaining === 1 ? "status-tight" : "status-full"}">
                  ${remaining > 1 ? "可接" : remaining === 1 ? "偏紧" : "已满"}
                </span>
              </div>
              <p class="cell-note">标准 ${state.week.dailyStandard} / 项目约 ${dailyProjectShare} / 扣减 ${eventUnits}</p>
              <p class="cell-note">${notes}</p>
            </td>
          `;
        })
        .join("");

      return `
        <tr>
          <td><strong>${member.name}</strong></td>
          ${cells}
        </tr>
      `;
    })
    .join("");

  selectors.scheduleTable.innerHTML = `${head}<tbody>${rows}</tbody>`;
}

function renderProjects() {
  const statusClassMap = {
    待开始: "status-info",
    进行中: "status-progress",
    待反馈: "status-tight",
    待交付: "status-progress",
    已完成: "status-done",
    阻塞: "status-blocked",
  };

  selectors.projectTable.innerHTML = `
    <thead>
      <tr>
        <th>项目</th>
        <th>负责人</th>
        <th>条数</th>
        <th>状态</th>
        <th>交付</th>
        <th>风险 / 依赖</th>
      </tr>
    </thead>
    <tbody>
      ${getScheduledItems()
        .map(
          (project) => `
            <tr>
              <td><strong>${project.name}</strong><p class="cell-note">${project.type} · ${project.priority}优先级 · ${project.source}</p></td>
              <td>${memberName(project.ownerId)}</td>
              <td>${project.units}</td>
              <td><span class="status-tag ${statusClassMap[project.status] || "status-info"}">${project.status}</span></td>
              <td>${project.due}</td>
              <td>${project.risk}</td>
            </tr>
          `
        )
        .join("")}
    </tbody>
  `;
}

function renderRequests() {
  const classMap = {
    待评估: "status-info",
    已接收: "status-good",
    排期中: "status-progress",
    暂缓: "status-tight",
    排到下周: "status-full",
    已完成: "status-done",
  };

  selectors.requestList.innerHTML = state.requests
    .map(
      (request) => `
        <article class="request-card">
          <header>
            <div>
              <h3>${request.name}</h3>
              <p>${request.requester} · ${request.channel || "未选择渠道"} · ${request.requestTopic || request.type}</p>
            </div>
            <span class="status-tag ${classMap[request.status] || "status-info"}">${request.status}</span>
          </header>
          <div class="request-detail-grid">
            <span><strong>${request.units}</strong> 条需求</span>
            <span>执行人：<strong>${memberName(request.assigneeId)}</strong></span>
            <span>期望交付：<strong>${request.due}</strong></span>
            ${
              request.docUrl
                ? `<a href="${request.docUrl}" target="_blank" rel="noreferrer">需求文档</a>`
                : "<span>暂无需求文档</span>"
            }
          </div>
          <p>${request.note}</p>
          <div class="card-meta">
            <span class="tag">${request.urgency}</span>
            <span class="tag">${request.channel || "未选择渠道"}</span>
            ${
              editing
                ? `<select data-request-assignee="${request.id}">
                    <option value="">未分配</option>
                    ${state.members
                      .map((member) => `<option value="${member.id}" ${member.id === request.assigneeId ? "selected" : ""}>${member.name}</option>`)
                      .join("")}
                  </select>
                  <select data-request-status="${request.id}">
                    ${["待评估", "已接收", "排期中", "暂缓", "排到下周", "已完成"]
                      .map((status) => `<option ${status === request.status ? "selected" : ""}>${status}</option>`)
                      .join("")}
                  </select>`
                : ""
            }
          </div>
        </article>
      `
    )
    .join("");

  document.querySelectorAll("[data-request-status]").forEach((select) => {
    select.addEventListener("change", () => {
      const request = state.requests.find((item) => item.id === select.dataset.requestStatus);
      request.status = select.value;
      saveState();
      render();
      showToast("需求状态已更新");
    });
  });

  document.querySelectorAll("[data-request-assignee]").forEach((select) => {
    select.addEventListener("change", () => {
      const request = state.requests.find((item) => item.id === select.dataset.requestAssignee);
      request.assigneeId = select.value;
      saveState();
      render();
      showToast("需求执行人已更新");
    });
  });
}

function renderEvents() {
  const days = dayLabels.slice(0, state.week.workdays);
  const header = `
    <div class="calendar-corner">成员</div>
    ${days.map((day) => `<div class="calendar-day">${day}</div>`).join("")}
  `;
  const rows = state.members
    .map((member) => {
      const cells = days
        .map((day, index) => {
          const dayNumber = index + 1;
          const events = state.events.filter((event) => event.memberId === member.id && Number(event.day) === dayNumber);
          return `
            <div class="calendar-cell" data-member="${member.id}" data-day="${dayNumber}">
              <div class="calendar-events">
                ${
                  events.length
                    ? events
                        .map(
                          (event) => `
                            <article class="calendar-event">
                              <strong>${event.type}</strong>
                              <span>扣 ${event.units} 条</span>
                              <p>${event.note}</p>
                            </article>
                          `
                        )
                        .join("")
                    : '<p class="empty-slot">暂无占用</p>'
                }
              </div>
              ${
                editing
                  ? `<button class="mini-button edit-only" data-add-event-member="${member.id}" data-add-event-day="${dayNumber}" type="button">+ 日程</button>`
                  : ""
              }
            </div>
          `;
        })
        .join("");

      return `
        <div class="calendar-member">
          <strong>${member.name}</strong>
        </div>
        ${cells}
      `;
    })
    .join("");

  selectors.eventGrid.style.setProperty("--calendar-days", String(days.length));
  selectors.eventGrid.innerHTML = `${header}${rows}`;

  document.querySelectorAll("[data-add-event-member]").forEach((button) => {
    button.addEventListener("click", () => {
      openEntry("event", {
        memberId: button.dataset.addEventMember,
        day: button.dataset.addEventDay,
      });
    });
  });
}

function setEditing(nextEditing) {
  editing = nextEditing;
  selectors.body.classList.toggle("editing", editing);
  selectors.modePill.textContent = editing ? "编辑模式" : "只读模式";
  selectors.editToggle.textContent = editing ? "退出编辑" : "进入编辑";
  render();
}

function showToast(message) {
  selectors.toast.textContent = message;
  selectors.toast.classList.add("show");
  window.setTimeout(() => selectors.toast.classList.remove("show"), 1800);
}

function openQuickAdjust(defaults = {}) {
  selectors.quickWeekType.value = state.week.type;
  selectors.quickWorkdays.value = state.week.workdays;
  selectors.quickDailyStandard.value = state.week.dailyStandard;
  selectors.quickWeekNote.value = "";

  activeEntryDefaults = defaults;
  selectors.quickEventFields.innerHTML = [
    ["memberId", "成员", "member"],
    ["day", "日期", "day"],
    ["type", "事项类型", "eventType"],
    ["units", "扣减条数", "number"],
    ["note", "日程备注", "text", "full"],
  ]
    .map(renderField)
    .join("");
  selectors.quickDialog.showModal();
}

function saveQuickWeek() {
  state.week.type = selectors.quickWeekType.value;
  state.week.workdays = Number(selectors.quickWorkdays.value || 5);
  state.week.dailyStandard = Number(selectors.quickDailyStandard.value || 4);

  const note = selectors.quickWeekNote.value.trim();
  if (note) {
    state.week.note = note;
  }

  saveState();
  render();
}

function saveQuickEvent() {
  const formData = new FormData(document.querySelector("#quick-form"));
  const event = {
    id: `event-${Date.now()}`,
    memberId: formData.get("memberId"),
    day: Number(formData.get("day") || 1),
    type: formData.get("type"),
    units: Number(formData.get("units") || 0),
    note: formData.get("note") || "临时日程调整",
  };

  state.events.push(event);
}

function openEntry(type, defaults = {}) {
  activeEntryType = type;
  activeEntryDefaults = defaults;
  const configs = {
    project: {
      kicker: "项目跟进",
      title: "新增项目",
      fields: [
        ["name", "项目名称", "text"],
        ["type", "内容类型", "text"],
        ["ownerId", "负责人", "member"],
        ["units", "内容条数", "number"],
        ["status", "状态", "projectStatus"],
        ["due", "预计交付", "text"],
        ["priority", "优先级", "text"],
        ["risk", "风险或依赖", "text", "full"],
      ],
    },
    request: {
      kicker: "需求池",
      title: "新增需求",
      fields: [
        ["requester", "你的名字", "text"],
        ["channel", "使用渠道", "channel"],
        ["requestTopic", "需求内容", "text"],
        ["type", "内容类型", "requestType"],
        ["assigneeId", "执行人", "member"],
        ["units", "需求数量", "number"],
        ["docUrl", "需求文档链接", "url", "full"],
        ["due", "期望交付日期", "text"],
        ["urgency", "紧急程度", "text"],
        ["status", "状态", "requestStatus"],
        ["note", "备注", "text", "full"],
      ],
    },
    event: {
      kicker: "占用扣减",
      title: "新增拍摄 / 会议 / 请假",
      fields: [
        ["memberId", "成员", "member"],
        ["day", "日期", "day"],
        ["type", "事项类型", "eventType"],
        ["units", "扣减条数", "number"],
        ["note", "备注", "text", "full"],
      ],
    },
  };

  const config = configs[type];
  selectors.entryKicker.textContent = config.kicker;
  selectors.entryTitle.textContent = config.title;
  selectors.entryFields.innerHTML = config.fields.map(renderField).join("");
  selectors.entryDialog.showModal();
}

function renderField([name, label, type, width]) {
  const className = width === "full" ? "full" : "";
  const defaultValue = activeEntryDefaults[name] ?? "";
  if (type === "member") {
    return `
      <label class="${className}">${label}
        <select name="${name}">
          ${state.members.map((member) => `<option value="${member.id}" ${member.id === defaultValue ? "selected" : ""}>${member.name}</option>`).join("")}
        </select>
      </label>
    `;
  }

  if (type === "projectStatus") {
    return renderSelect(name, label, ["待开始", "进行中", "待反馈", "待交付", "已完成", "阻塞"], className);
  }

  if (type === "requestStatus") {
    return renderSelect(name, label, ["待评估", "已接收", "排期中", "暂缓", "排到下周", "已完成"], className);
  }

  if (type === "channel") {
    return renderSelect(name, label, ["亚马逊", "官网"], className);
  }

  if (type === "requestType") {
    return renderSelect(name, label, ["轻量视频", "新拍摄", "混剪", "直播切片", "脚本需求"], className);
  }

  if (type === "eventType") {
    return renderSelect(name, label, ["半天拍摄", "全天拍摄", "重点会议", "请假半天", "请假全天", "其他"], className);
  }

  if (type === "day") {
    return renderSelect(name, label, dayLabels.slice(0, state.week.workdays).map((day, index) => `${index + 1}:${day}`), className);
  }

  return `
    <label class="${className}">${label}
      <input name="${name}" type="${type}" value="${defaultValue}" ${type === "number" ? 'min="0"' : ""} />
    </label>
  `;
}

function renderSelect(name, label, options, className) {
  const defaultValue = activeEntryDefaults[name] ?? "";
  return `
    <label class="${className}">${label}
      <select name="${name}">
        ${options
          .map((option) => {
            const [value, text] = option.includes(":") ? option.split(":") : [option, option];
            return `<option value="${value}" ${String(value) === String(defaultValue) ? "selected" : ""}>${text}</option>`;
          })
          .join("")}
      </select>
    </label>
  `;
}

function saveEntry() {
  const formData = new FormData(document.querySelector("#entry-form"));
  const entry = Object.fromEntries(formData.entries());
  entry.id = `${activeEntryType}-${Date.now()}`;

  if ("units" in entry) entry.units = Number(entry.units || 0);
  if ("day" in entry) entry.day = Number(entry.day || 1);
  if (activeEntryType === "request") {
    entry.requester = entry.requester.trim() || "未署名";
    entry.requestTopic = entry.requestTopic.trim() || entry.type || "视频";
    entry.name = `${entry.requester}${entry.channel}${entry.requestTopic}需求`;
  }

  if (activeEntryType === "project") state.projects.push(entry);
  if (activeEntryType === "request") state.requests.push(entry);
  if (activeEntryType === "event") state.events.push(entry);

  saveState();
  selectors.entryDialog.close();
  render();
  showToast("已保存，产能已重新计算");
}

selectors.editToggle.addEventListener("click", () => {
  if (editing) {
    setEditing(false);
    showToast("已退出编辑模式");
    return;
  }
  selectors.passwordInput.value = "";
  selectors.passwordError.textContent = "";
  selectors.passwordDialog.showModal();
});

selectors.confirmPassword.addEventListener("click", () => {
  if (selectors.passwordInput.value !== EDIT_PASSWORD) {
    selectors.passwordError.textContent = "密码不正确。预览密码是 content2026。";
    return;
  }
  selectors.passwordDialog.close();
  setEditing(true);
  if (pendingQuickAdjust) {
    pendingQuickAdjust = false;
    openQuickAdjust();
  }
  showToast("已进入编辑模式");
});

selectors.saveWeek.addEventListener("click", () => {
  state.week.type = selectors.weekType.value;
  state.week.workdays = Number(selectors.workdays.value || 5);
  state.week.dailyStandard = Number(selectors.dailyStandard.value || 4);
  saveState();
  render();
  showToast("本周设置已更新");
});

selectors.weekType.addEventListener("change", () => {
  selectors.workdays.value = selectors.weekType.value === "big" ? 5 : 6;
});

selectors.quickAdjust.addEventListener("click", () => {
  if (!editing) {
    pendingQuickAdjust = true;
    selectors.passwordInput.value = "";
    selectors.passwordError.textContent = "";
    selectors.passwordDialog.showModal();
    return;
  }

  openQuickAdjust();
});

selectors.quickWeekType.addEventListener("change", () => {
  selectors.quickWorkdays.value = selectors.quickWeekType.value === "big" ? 5 : 6;
});

selectors.quickSaveWeek.addEventListener("click", () => {
  saveQuickWeek();
  selectors.quickDialog.close();
  showToast("本周工作日设置已更新");
});

selectors.quickSaveAll.addEventListener("click", () => {
  saveQuickWeek();
  saveQuickEvent();
  saveState();
  selectors.quickDialog.close();
  render();
  showToast("已更新工作日并新增日程");
});

selectors.resetDemo.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(defaultState);
  setEditing(false);
  showToast("样例数据已重置");
});

selectors.addProject.addEventListener("click", () => openEntry("project"));
selectors.addRequest.addEventListener("click", () => openEntry("request"));
selectors.addEvent.addEventListener("click", () => openEntry("event"));
selectors.saveEntry.addEventListener("click", saveEntry);

render();
