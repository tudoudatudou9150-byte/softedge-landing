const STORAGE_KEY = "content-team-dashboard-preview";
const EDIT_PASSWORD = "content2026";
const DATA_VERSION = 10;
const CURRENT_WEEK_KEY = getWeekKey(new Date());
const SUPABASE_URL = "https://vcxetbbpigobkekqzmoy.supabase.co";
const SUPABASE_KEY = "sb_publishable_n6nVRvL9i5DgDUeEMp-ikw_TszSFoiF";
const SUPABASE_TABLE = "content_dashboard_state";
const REMOTE_STATE_ID = "main";

const defaultState = {
  version: DATA_VERSION,
  week: {
    type: "small",
    workdays: 6,
    dailyStandard: 4,
    currentWeekKey: CURRENT_WEEK_KEY,
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
      weekKey: CURRENT_WEEK_KEY,
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
      weekKey: "",
      note: "本周拍摄产能不足",
    },
  ],
};

let state = loadState();
let editing = false;
let activeEntryType = "";
let activeEntryDefaults = {};
let activeEntryId = "";
let pendingQuickAdjust = false;
let syncReady = false;
let syncTimer = 0;

const dayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const selectors = {
  body: document.body,
  syncPill: document.querySelector("#sync-pill"),
  modePill: document.querySelector("#mode-pill"),
  editToggle: document.querySelector("#edit-toggle"),
  quickAdjust: document.querySelector("#quick-adjust"),
  statusTitle: document.querySelector("#status-title"),
  statusCopy: document.querySelector("#status-copy"),
  capacityProgress: document.querySelector("#capacity-progress"),
  metricGrid: document.querySelector("#metric-grid"),
  scheduleTable: document.querySelector("#schedule-table"),
  projectTable: document.querySelector("#project-table"),
  requestList: document.querySelector("#request-list"),
  internalBoard: document.querySelector("#internal-board"),
  historyList: document.querySelector("#history-list"),
  memberList: document.querySelector("#member-list"),
  newMemberName: document.querySelector("#new-member-name"),
  addMember: document.querySelector("#add-member"),
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
    return migrateState(parsed);
  } catch {
    return structuredClone(defaultState);
  }
}

function setSyncStatus(status, text) {
  if (!selectors.syncPill) return;
  selectors.syncPill.textContent = text;
  selectors.syncPill.dataset.status = status;
}

function remoteHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    ...extra,
  };
}

async function fetchRemoteState() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.${REMOTE_STATE_ID}&select=data`, {
    headers: remoteHeaders(),
  });

  if (!response.ok) throw new Error(`读取共享数据失败：${response.status}`);
  const rows = await response.json();
  return rows[0]?.data || null;
}

async function upsertRemoteState(nextState) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?on_conflict=id`, {
    method: "POST",
    headers: remoteHeaders({
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify({
      id: REMOTE_STATE_ID,
      data: nextState,
    }),
  });

  if (!response.ok) throw new Error(`同步共享数据失败：${response.status}`);
}

async function initializeRemoteSync() {
  setSyncStatus("syncing", "连接中");

  try {
    const remoteState = await fetchRemoteState();
    if (remoteState) {
      state = migrateState(remoteState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      render();
      syncReady = true;
      setSyncStatus("online", "已同步");

      if (state.week.currentWeekKey === CURRENT_WEEK_KEY) {
        queueRemoteSave();
      }
      return;
    }

    syncReady = true;
    await upsertRemoteState(state);
    setSyncStatus("online", "已同步");
  } catch (error) {
    console.error(error);
    syncReady = false;
    setSyncStatus("offline", "离线本地");
    showToast("共享数据库暂时不可用，当前使用本地数据");
  }
}

function queueRemoteSave() {
  if (!syncReady) return;
  window.clearTimeout(syncTimer);
  setSyncStatus("syncing", "同步中");
  syncTimer = window.setTimeout(async () => {
    try {
      await upsertRemoteState(state);
      setSyncStatus("online", "已同步");
    } catch (error) {
      console.error(error);
      setSyncStatus("offline", "同步失败");
      showToast("同步失败，已先保存在本地");
    }
  }, 250);
}

function migrateState(parsed) {
  const migrated = structuredClone(defaultState);
  Object.assign(migrated, parsed);
  migrated.version = DATA_VERSION;
  migrated.week = { ...defaultState.week, ...(parsed.week || {}) };
  if (migrated.week.currentWeekKey === getPreviousDateKey(CURRENT_WEEK_KEY)) {
    migrated.week.currentWeekKey = CURRENT_WEEK_KEY;
  }
  migrated.members = parsed.members || defaultState.members;
  migrated.events = parsed.events || defaultState.events;
  migrated.projects = (parsed.projects || defaultState.projects).map((project) => {
    const ownerIds = project.ownerIds || (project.ownerId ? [project.ownerId] : []);
    return {
      ...project,
      ownerIds,
      ownerId: ownerIds[0] || "",
    };
  });
  migrated.requests = (parsed.requests || defaultState.requests).map((request) => {
    const assigneeIds = request.assigneeIds || (request.assigneeId ? [request.assigneeId] : []);
    return {
      ...request,
      assigneeIds,
      assigneeId: assigneeIds[0] || "",
      urgency: getAutoUrgency(request),
      weekKey: request.weekKey ?? (["已接收", "排期中", "已完成"].includes(request.status) ? migrated.week.currentWeekKey : ""),
    };
  });
  autoResetWeeklySchedule(migrated);
  return migrated;
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPreviousDateKey(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return getDateKey(date);
}

function getWeekKey(date) {
  const target = new Date(date);
  const day = target.getDay() || 7;
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() - day + 1);
  return getDateKey(target);
}

function autoResetWeeklySchedule(nextState) {
  if (nextState.week.currentWeekKey === CURRENT_WEEK_KEY) return;

  nextState.projects = [];
  nextState.events = [];
  nextState.requests = nextState.requests.map((request) => {
    if (request.status === "已完成") {
      return {
        ...request,
        status: "归档历史",
        archivedAt: request.archivedAt || nextState.week.currentWeekKey,
      };
    }

    if (["已接收", "排期中", "待评估", "暂缓", "排到下周"].includes(request.status)) {
      const carriedNote = request.note || "";
      return {
        ...request,
        status: "待评估",
        weekKey: "",
        note: carriedNote.includes("上周未完成") ? carriedNote : `上周未完成，需重新排期。${carriedNote}`,
      };
    }

    return request;
  });
  nextState.week.currentWeekKey = CURRENT_WEEK_KEY;
  nextState.week.note = "已自动进入新一周，未完成需求保留在需求池。";
}

function saveState() {
  state.week.updatedAt = new Date().toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  queueRemoteSave();
}

function memberName(id) {
  return state.members.find((member) => member.id === id)?.name || "未分配";
}

function getAssigneeIds(item) {
  return item.assigneeIds || (item.assigneeId ? [item.assigneeId] : []);
}

function assigneeNames(item) {
  const names = getAssigneeIds(item).map(memberName).filter((name) => name !== "未分配");
  return names.length ? names.join("、") : "未分配";
}

function daysUntilDue(due) {
  if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(`${due}T00:00:00`);
  return Math.ceil((dueDate - today) / 86400000);
}

function getWeekdayDate(day) {
  const date = new Date(`${state.week.currentWeekKey || CURRENT_WEEK_KEY}T00:00:00`);
  date.setDate(date.getDate() + Number(day || 1) - 1);
  return date;
}

function isPastWorkday(day) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return getWeekdayDate(day) < today;
}

function getAutoUrgency(request) {
  if (daysUntilDue(request.due) <= 1) return "紧急";
  if (request.channel === "官网") return "优先";
  return "普通";
}

function requestStatusToProjectStatus(status) {
  const statusMap = {
    已接收: "待开始",
    排期中: "进行中",
    已完成: "已完成",
  };

  return statusMap[status] || "待评估";
}

function getOwnerIds(project) {
  return project.ownerIds || (project.ownerId ? [project.ownerId] : []);
}

function isRequestScheduled(request) {
  return ["已接收", "排期中", "已完成"].includes(request.status) && request.weekKey === state.week.currentWeekKey;
}

function getScheduledItems() {
  const manualProjects = state.projects.map((project) => ({
    ...project,
    ownerIds: project.ownerIds || (project.ownerId ? [project.ownerId] : []),
    source: "手动项目",
  }));
  const syncedRequests = state.requests.filter(isRequestScheduled).map((request) => ({
    id: `request-${request.id}`,
    name: request.name,
    type: `${request.channel || "未选择渠道"} · ${request.type}`,
    ownerId: request.assigneeId,
    ownerIds: getAssigneeIds(request),
    units: request.units,
    status: requestStatusToProjectStatus(request.status),
    due: request.due,
    priority: getAutoUrgency(request) === "紧急" ? "高" : getAutoUrgency(request) === "优先" ? "中高" : "中",
    risk: request.note || "来自需求池自动同步",
    source: "需求池同步",
  }));

  return [...manualProjects, ...syncedRequests];
}

function projectUnitsByMember(memberId) {
  return getScheduledItems()
    .filter((project) => {
      const ownerIds = getOwnerIds(project);
      return ownerIds.includes(memberId);
    })
    .reduce((total, project) => {
      const ownerIds = getOwnerIds(project);
      const splitBy = Math.max(ownerIds.length, 1);
      return total + Number(project.units || 0) / splitBy;
    }, 0);
}

function getPlanningDays() {
  const days = Array.from({ length: state.week.workdays }, (_, index) => index + 1);
  const availableDays = days.filter((day) => !isPastWorkday(day));
  return availableDays.length ? availableDays : days;
}

function projectDayLabel(project) {
  const day = Number(project.day || 0);
  if (day) return dayLabels[day - 1] || `第 ${day} 天`;
  return project.due || "未填写日期";
}

function projectUnitsByMemberDay(memberId, day) {
  const planningDays = getPlanningDays();
  return getScheduledItems()
    .filter((project) => getOwnerIds(project).includes(memberId))
    .reduce((total, project) => {
      const ownerIds = getOwnerIds(project);
      const splitBy = Math.max(ownerIds.length, 1);
      const memberUnits = Number(project.units || 0) / splitBy;
      const projectDay = Number(project.day || 0);

      if (projectDay) {
        return projectDay === Number(day) ? total + memberUnits : total;
      }

      if (!planningDays.includes(Number(day))) return total;
      return total + memberUnits / planningDays.length;
    }, 0);
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
  const futureRemaining = state.members.reduce((memberTotal, member) => {
    const dayTotal = Array.from({ length: state.week.workdays }, (_, index) => index + 1)
      .filter((day) => !isPastWorkday(day))
      .reduce((total, day) => {
        const eventUnits = eventUnitsByMemberDay(member.id, day);
        const projectUnits = projectUnitsByMemberDay(member.id, day);
        return total + Math.max(state.week.dailyStandard - eventUnits - projectUnits, 0);
      }, 0);
    return memberTotal + dayTotal;
  }, 0);
  const remaining = Math.floor(futureRemaining);
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
  renderMembers();
  renderHero();
  renderMetrics();
  renderSchedule();
  renderProjects();
  renderInternalBoard();
  renderRequests();
  renderEvents();
  renderHistory();
}

function renderWeekEditor() {
  selectors.weekType.value = state.week.type;
  selectors.workdays.value = state.week.workdays;
  selectors.dailyStandard.value = state.week.dailyStandard;
}

function renderMembers() {
  if (!selectors.memberList) return;
  selectors.memberList.innerHTML = state.members
    .map(
      (member) => `
        <article class="member-chip">
          <strong>${member.name}</strong>
          <button class="danger-button" data-delete-member="${member.id}" type="button">删除</button>
        </article>
      `
    )
    .join("");

  document.querySelectorAll("[data-delete-member]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteMember(button.dataset.deleteMember);
    });
  });
}

function addMember() {
  const name = selectors.newMemberName.value.trim();
  if (!name) {
    showToast("请先输入成员姓名");
    return;
  }

  if (state.members.some((member) => member.name === name)) {
    showToast("成员已存在");
    return;
  }

  state.members.push({
    id: `member-${Date.now()}`,
    name,
  });
  selectors.newMemberName.value = "";
  saveState();
  render();
  showToast("成员已新增");
}

function deleteMember(memberId) {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return;
  if (!window.confirm(`确认删除成员「${member.name}」吗？相关项目和需求会变为未分配，TA的日程占用会被移除。`)) return;

  state.members = state.members.filter((item) => item.id !== memberId);
  state.projects = state.projects.map((project) =>
    (project.ownerIds || (project.ownerId ? [project.ownerId] : [])).includes(memberId)
      ? {
          ...project,
          ownerIds: (project.ownerIds || (project.ownerId ? [project.ownerId] : [])).filter((id) => id !== memberId),
          ownerId: (project.ownerIds || (project.ownerId ? [project.ownerId] : [])).filter((id) => id !== memberId)[0] || "",
        }
      : project
  );
  state.requests = state.requests.map((request) =>
    getAssigneeIds(request).includes(memberId)
      ? {
          ...request,
          assigneeIds: getAssigneeIds(request).filter((id) => id !== memberId),
          assigneeId: getAssigneeIds(request).filter((id) => id !== memberId)[0] || "",
        }
      : request
  );
  state.events = state.events.filter((event) => event.memberId !== memberId);

  saveState();
  render();
  showToast(`${member.name} 已删除，相关内容已改为未分配`);
}

function deleteProject(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  if (!window.confirm(`确认删除项目「${project.name}」吗？`)) return;

  state.projects = state.projects.filter((item) => item.id !== projectId);
  saveState();
  render();
  showToast("项目已删除");
}

function addInternalProject(memberId = "") {
  const member = state.members.find((item) => item.id === memberId);
  openEntry("internalProject", {
    type: "自主安排",
    ownerIds: member ? [member.id] : [],
    ownerName: member ? member.name : "未分配",
    day: Math.min(getPlanningDays()[0] || 1, state.week.workdays),
    status: "待开始",
    priority: "中",
    risk: "自主安排",
  });
}

function editInternalProject(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;

  const ownerIds = getOwnerIds(project);
  openEntry(
    "internalProject",
    {
      ...project,
      ownerIds,
      ownerName: ownerIds.map(memberName).join("、") || "未分配",
      editingId: project.id,
    },
    project.id
  );
}

function deleteRequest(requestId) {
  const request = state.requests.find((item) => item.id === requestId);
  if (!request) return;
  if (!window.confirm(`确认删除需求「${request.name}」吗？这条需求也会从本周已排内容中移除。`)) return;

  state.requests = state.requests.filter((item) => item.id !== requestId);
  saveState();
  render();
  showToast("需求已删除");
}

function deleteEvent(eventId) {
  const event = state.events.find((item) => item.id === eventId);
  if (!event) return;
  if (!window.confirm(`确认删除日程「${event.type}」吗？`)) return;

  state.events = state.events.filter((item) => item.id !== eventId);
  saveState();
  render();
  showToast("日程已删除，占用扣减已重新计算");
}

function renderHero() {
  const capacity = getCapacity();
  const remainingText = capacity.remaining > 0 ? `还可接约 ${capacity.remaining} 条视频需求` : "本周暂无可接视频产能";
  const weekLabel = state.week.type === "big" ? "大周（工作5天，休息2天）" : "小周（工作6天，休息1天）";
  const used = Math.max(capacity.theoretical - capacity.remaining, 0);
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
      <span><i class="legend-used"></i>已占用 / 已过 ${used} 条</span>
      <span><i class="legend-remaining"></i>剩余 ${remaining} 条</span>
      <span><i class="legend-warning"></i>拍摄/会议/请假扣减 ${capacity.eventDeduction} 条</span>
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
    ["剩余可接", capacity.remaining, capacity.remaining > 0 ? "按今天及未来可用产能估算" : "需要重新排期"],
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
  const head = `<thead><tr><th>成员</th>${days
    .map((day, index) => {
      const dayNumber = index + 1;
      return `<th class="${isPastWorkday(dayNumber) ? "past-day" : ""}">${day}${isPastWorkday(dayNumber) ? '<span class="past-label">已过</span>' : ""}</th>`;
    })
    .join("")}</tr></thead>`;
  const rows = state.members
    .map((member) => {
      const cells = days
        .map((_, index) => {
          const day = index + 1;
          const eventUnits = eventUnitsByMemberDay(member.id, day);
          const projectUnits = projectUnitsByMemberDay(member.id, day);
          const dailyProjectShare = Math.ceil(projectUnits);
          const remaining = Math.max(state.week.dailyStandard - eventUnits - projectUnits, 0);
          const notes = eventNotes(member.id, day) || "无特殊占用";
          const pastClass = isPastWorkday(day) ? " past-day" : "";
          return `
            <td class="schedule-cell${pastClass}">
              <div class="cell-main">
                <span>余 ${remaining} 条</span>
                <span class="status-tag ${remaining > 1 ? "status-good" : remaining === 1 ? "status-tight" : "status-full"}">
                  ${remaining > 1 ? "可接" : remaining === 1 ? "偏紧" : "已满"}
                </span>
              </div>
              <p class="cell-note">标准 ${state.week.dailyStandard} / 已排约 ${dailyProjectShare} / 扣减 ${eventUnits}</p>
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
        <th>制作人</th>
        <th>条数</th>
        <th>状态</th>
        <th>交付</th>
        <th>风险 / 依赖</th>
        ${editing ? "<th>操作</th>" : ""}
      </tr>
    </thead>
    <tbody>
      ${getScheduledItems()
        .map(
          (project) => `
            <tr>
              <td><strong>${project.name}</strong><p class="cell-note">${project.type} · ${project.priority}优先级 · ${project.source}</p></td>
              <td>${project.ownerIds ? project.ownerIds.map(memberName).join("、") || "未分配" : memberName(project.ownerId)}</td>
              <td>${project.units}</td>
              <td><span class="status-tag ${statusClassMap[project.status] || "status-info"}">${project.status}</span></td>
              <td>${project.due}</td>
              <td>${project.risk}</td>
              ${
                editing
                  ? `<td>${
                      project.source === "手动项目"
                        ? `<button class="danger-button" data-delete-project="${project.id}" type="button">删除</button>`
                        : '<span class="cell-note">在需求池维护</span>'
                    }</td>`
                  : ""
              }
            </tr>
          `
        )
        .join("")}
    </tbody>
  `;

  document.querySelectorAll("[data-delete-project]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteProject(button.dataset.deleteProject);
    });
  });
}

function renderInternalBoard() {
  if (!selectors.internalBoard) return;
  const manualProjects = state.projects;
  const unassignedProjects = manualProjects.filter((project) => getOwnerIds(project).length === 0);

  const memberColumns = state.members.map((member) => {
    const memberProjects = manualProjects.filter((project) => {
      return getOwnerIds(project).includes(member.id);
    });

    return renderInternalColumn(member.name, memberProjects, member.id);
  });

  selectors.internalBoard.innerHTML = [
    ...memberColumns,
    renderInternalColumn("未分配", unassignedProjects, ""),
  ].join("");

  selectors.internalBoard.querySelectorAll("[data-add-internal]").forEach((button) => {
    button.addEventListener("click", () => {
      addInternalProject(button.dataset.addInternal || "");
    });
  });

  selectors.internalBoard.querySelectorAll("[data-edit-internal]").forEach((button) => {
    button.addEventListener("click", () => {
      editInternalProject(button.dataset.editInternal);
    });
  });

  selectors.internalBoard.querySelectorAll("[data-delete-internal]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteProject(button.dataset.deleteInternal);
    });
  });
}

function renderInternalColumn(title, projects, memberId) {
  return `
    <article class="internal-column">
      <header>
        <div>
          <strong>${title}</strong>
          <span>${projects.length} 项</span>
        </div>
        <button class="mini-button edit-only" data-add-internal="${memberId}" type="button">添加</button>
      </header>
      <div class="internal-task-list">
        ${
          projects.length
            ? projects
                .map(
                  (project) => `
                    <article class="internal-task">
                      <div class="internal-task-head">
                        <h3>${project.name}</h3>
                        ${
                          editing
                            ? `<div class="inline-actions">
                                <button class="inline-edit" data-edit-internal="${project.id}" type="button">修改</button>
                                <button class="inline-danger" data-delete-internal="${project.id}" type="button">删除</button>
                              </div>`
                            : ""
                        }
                      </div>
                      <p>${project.type || "自主安排"} · ${project.units || 0} 条 · ${projectDayLabel(project)}</p>
                      <span class="status-tag status-info">${project.status || "待开始"}</span>
                    </article>
                  `
                )
                .join("")
            : '<p class="empty-slot">暂无安排</p>'
        }
      </div>
    </article>
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
    归档历史: "status-archive",
  };

  const activeRequests = state.requests.filter((request) => request.status !== "归档历史" && request.status !== "已完成");

  selectors.requestList.innerHTML = activeRequests.length
    ? activeRequests
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
            <span>制作人：<strong>${assigneeNames(request)}</strong></span>
            <span>期望交付：<strong>${request.due}</strong></span>
            ${
              request.docUrl
                ? `<a href="${request.docUrl}" target="_blank" rel="noreferrer">需求文档</a>`
                : "<span>暂无需求文档</span>"
            }
          </div>
          <p>${request.note}</p>
          <div class="card-meta">
            <span class="tag">${getAutoUrgency(request)}</span>
            <span class="tag">${request.channel || "未选择渠道"}</span>
            ${
              editing
                ? `<select data-request-assignee="${request.id}" multiple size="${Math.min(Math.max(state.members.length, 2), 4)}">
                    ${state.members
                      .map((member) => `<option value="${member.id}" ${getAssigneeIds(request).includes(member.id) ? "selected" : ""}>${member.name}</option>`)
                      .join("")}
                  </select>
                  <select data-request-status="${request.id}">
                    ${["待评估", "已接收", "排期中", "暂缓", "排到下周", "已完成", "归档历史"]
                      .map((status) => `<option ${status === request.status ? "selected" : ""}>${status}</option>`)
                      .join("")}
                  </select>
                  <button class="danger-button" data-delete-request="${request.id}" type="button">删除需求</button>`
                : ""
            }
          </div>
        </article>
      `
    )
    .join("")
    : '<article class="empty-card">暂无待评估或待排期需求</article>';

  document.querySelectorAll(".request-list [data-request-status]").forEach((select) => {
    select.addEventListener("change", () => {
      const request = state.requests.find((item) => item.id === select.dataset.requestStatus);
      updateRequestStatus(request, select.value);
      saveState();
      render();
      showToast("需求状态已更新");
    });
  });

  document.querySelectorAll("[data-request-assignee]").forEach((select) => {
    select.addEventListener("change", () => {
      const request = state.requests.find((item) => item.id === select.dataset.requestAssignee);
      request.assigneeIds = Array.from(select.selectedOptions).map((option) => option.value);
      request.assigneeId = request.assigneeIds[0] || "";
      saveState();
      render();
      showToast("需求制作人已更新");
    });
  });

  document.querySelectorAll("[data-delete-request]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteRequest(button.dataset.deleteRequest);
    });
  });
}

function renderHistory() {
  const historyRequests = state.requests.filter((request) => ["已完成", "归档历史"].includes(request.status));
  const completedCount = historyRequests.filter((request) => request.status === "已完成").length;
  const archivedCount = historyRequests.filter((request) => request.status === "归档历史").length;
  const recentRequests = historyRequests.slice(-3).reverse();

  selectors.historyList.innerHTML = historyRequests.length
    ? `
      <div class="archive-summary">
        <article>
          <span>历史收录</span>
          <strong>${historyRequests.length}</strong>
        </article>
        <article>
          <span>本周完成</span>
          <strong>${completedCount}</strong>
        </article>
        <article>
          <span>归档历史</span>
          <strong>${archivedCount}</strong>
        </article>
      </div>
      <div class="history-preview-head">
        <span>最近收录</span>
        <a href="history.html">进入历史库</a>
      </div>
      <div class="history-preview-list">
        ${recentRequests
        .map(
          (request) => `
            <button class="history-card history-card-button" data-history-detail="${request.id}" type="button">
              <header>
                <div>
                  <h3>${request.name}</h3>
                  <p>${request.requester} · ${request.channel || "未选择渠道"} · ${request.type}</p>
                </div>
                <span class="status-tag ${request.status === "已完成" ? "status-done" : "status-archive"}">${request.status}</span>
              </header>
              <div class="history-meta">
                <span>${request.units} 条</span>
                <span>制作人：${assigneeNames(request)}</span>
                <span>交付：${request.due}</span>
                <span>${request.weekKey === state.week.currentWeekKey ? "本周完成，仍计入产能" : "历史归档，不占本周产能"}</span>
              </div>
            </button>
          `
        )
        .join("")}
      </div>
    `
    : '<article class="empty-card">暂无历史需求记录</article>';

  document.querySelectorAll("[data-history-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const request = state.requests.find((item) => item.id === button.dataset.historyDetail);
      openRequestDetail(request);
    });
  });
}

function openRequestDetail(request) {
  if (!request) return;
  const dialog = ensureDetailDialog();
  dialog.querySelector("#detail-title").textContent = request.name;
  dialog.querySelector("#detail-body").innerHTML = `
    <div class="detail-grid">
      <span><strong>提交人</strong>${request.requester || "未署名"}</span>
      <span><strong>渠道</strong>${request.channel || "未选择渠道"}</span>
      <span><strong>需求内容</strong>${request.requestTopic || "视频需求"}</span>
      <span><strong>内容类型</strong>${request.type || "未填写"}</span>
      <span><strong>制作人</strong>${assigneeNames(request)}</span>
      <span><strong>需求数量</strong>${request.units || 0} 条</span>
      <span><strong>期望交付</strong>${request.due || "未填写"}</span>
      <span><strong>状态</strong>${request.status || "待评估"}</span>
    </div>
    <p class="detail-note">${request.note || "暂无备注"}</p>
    ${
      request.docUrl
        ? `<a class="primary-button detail-link" href="${request.docUrl}" target="_blank" rel="noreferrer">打开需求文档</a>`
        : '<span class="helper-text">暂无需求文档</span>'
    }
  `;
  dialog.showModal();
}

function ensureDetailDialog() {
  let dialog = document.querySelector("#request-detail-dialog");
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.className = "modal wide-modal";
  dialog.id = "request-detail-dialog";
  dialog.innerHTML = `
    <form method="dialog" class="modal-card">
      <div class="section-head">
        <div>
          <p class="eyebrow">历史详情</p>
          <h2 id="detail-title">需求详情</h2>
        </div>
        <button class="icon-button" value="cancel" aria-label="关闭" type="submit">×</button>
      </div>
      <div id="detail-body"></div>
      <div class="modal-actions">
        <button class="ghost-button" value="cancel" type="submit">关闭</button>
      </div>
    </form>
  `;
  document.body.appendChild(dialog);
  return dialog;
}

function updateRequestStatus(request, status) {
  request.status = status;

  if (["已接收", "排期中", "已完成"].includes(status)) {
    request.weekKey = state.week.currentWeekKey;
  }

  if (status === "归档历史") {
    request.weekKey = "";
    request.archivedAt = request.archivedAt || state.week.currentWeekKey;
  }
}

function renderEvents() {
  const days = dayLabels.slice(0, state.week.workdays);
  const header = `
    <div class="calendar-corner">成员</div>
    ${days
      .map((day, index) => {
        const dayNumber = index + 1;
        return `<div class="calendar-day ${isPastWorkday(dayNumber) ? "past-day" : ""}">${day}${isPastWorkday(dayNumber) ? '<span class="past-label">已过</span>' : ""}</div>`;
      })
      .join("")}
  `;
  const rows = state.members
    .map((member) => {
      const cells = days
        .map((day, index) => {
          const dayNumber = index + 1;
          const events = state.events.filter((event) => event.memberId === member.id && Number(event.day) === dayNumber);
          return `
            <div class="calendar-cell ${isPastWorkday(dayNumber) ? "past-day" : ""}" data-member="${member.id}" data-day="${dayNumber}">
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
                              ${
                                editing
                                  ? `<button class="event-delete-button" data-delete-event="${event.id}" type="button">删除</button>`
                                  : ""
                              }
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

  document.querySelectorAll("[data-delete-event]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteEvent(button.dataset.deleteEvent);
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

function openEntry(type, defaults = {}, editingId = "") {
  activeEntryType = type;
  activeEntryDefaults = defaults;
  activeEntryId = editingId;
  const configs = {
    project: {
      kicker: "项目跟进",
      title: "新增项目",
      fields: [
        ["name", "项目名称", "text"],
        ["type", "内容类型", "text"],
        ["ownerIds", "制作人", "memberMulti"],
        ["units", "内容条数", "number"],
        ["status", "状态", "projectStatus"],
        ["due", "预计交付", "text"],
        ["priority", "优先级", "text"],
        ["risk", "风险或依赖", "text", "full"],
      ],
    },
    internalProject: {
      kicker: "内部安排",
      title: `${editingId ? "修改" : "新增"}${defaults.ownerName || "成员"}安排`,
      fields: [
        ["name", "安排内容", "text"],
        ["type", "内容类型", "text"],
        ...(editingId ? [["ownerIds", "成员", "memberMulti"]] : []),
        ["day", "安排日期", "day"],
        ["units", "内容条数", "number"],
        ["status", "状态", "projectStatus"],
        ["priority", "优先级", "text"],
        ["risk", "备注", "text", "full"],
      ],
    },
    request: {
      kicker: "需求池",
      title: "下需求",
      fields: [
        ["requester", "你的名字", "text"],
        ["channel", "使用渠道", "channel"],
        ["requestTopic", "需求内容", "text"],
        ["type", "内容类型", "requestType"],
        ["units", "需求数量", "number"],
        ["docUrl", "需求文档链接", "url", "full"],
        ["due", "期望交付日期", "date"],
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

  if (type === "memberMulti") {
    const values = Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : [];
    return `
      <label class="${className}">${label}
        <select name="${name}" multiple size="${Math.min(Math.max(state.members.length, 2), 5)}">
          ${state.members.map((member) => `<option value="${member.id}" ${values.includes(member.id) ? "selected" : ""}>${member.name}</option>`).join("")}
        </select>
      </label>
    `;
  }

  if (type === "projectStatus") {
    return renderSelect(name, label, ["待开始", "进行中", "待反馈", "待交付", "已完成", "阻塞"], className);
  }

  if (type === "requestStatus") {
    return renderSelect(name, label, ["待评估", "已接收", "排期中", "暂缓", "排到下周", "已完成", "归档历史"], className);
  }

  if (type === "channel") {
    return renderSelect(name, label, ["亚马逊", "官网"], className);
  }

  if (type === "requestType") {
    return renderSelect(name, label, ["旧方向新拍摄", "新方向新拍摄", "横屏独立视频", "混剪"], className);
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
  entry.id = activeEntryId || `${activeEntryType}-${Date.now()}`;

  if ("units" in entry) entry.units = Number(entry.units || 0);
  if ("day" in entry) entry.day = Number(entry.day || 1);
  if (activeEntryType === "request") {
    entry.requester = entry.requester.trim() || "未署名";
    entry.requestTopic = entry.requestTopic.trim() || entry.type || "视频";
    entry.name = `${entry.requester}${entry.channel}${entry.requestTopic}需求`;
    entry.assigneeIds = [];
    entry.assigneeId = "";
    entry.status = "待评估";
    entry.urgency = getAutoUrgency(entry);
    entry.weekKey = ["已接收", "排期中", "已完成"].includes(entry.status) ? state.week.currentWeekKey : "";
    if (entry.status === "归档历史") entry.archivedAt = state.week.currentWeekKey;
  }

  if (activeEntryType === "project") {
    entry.ownerIds = formData.getAll("ownerIds");
    entry.ownerId = entry.ownerIds[0] || "";
  }

  if (activeEntryType === "internalProject") {
    entry.day = Number(entry.day || 1);
    entry.due = dayLabels[entry.day - 1] || "本周";
    entry.ownerIds = formData.has("ownerIds") ? formData.getAll("ownerIds") : activeEntryDefaults.ownerIds || [];
    entry.ownerId = entry.ownerIds[0] || "";
  }

  if (activeEntryType === "project") state.projects.push(entry);
  if (activeEntryType === "internalProject") {
    if (activeEntryId) {
      state.projects = state.projects.map((project) => (project.id === activeEntryId ? entry : project));
    } else {
      state.projects.push(entry);
    }
  }
  if (activeEntryType === "request") state.requests.push(entry);
  if (activeEntryType === "event") state.events.push(entry);

  saveState();
  selectors.entryDialog.close();
  activeEntryId = "";
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
    selectors.passwordError.textContent = "密码不正确，请确认后重新输入。";
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

selectors.addProject.addEventListener("click", () => openEntry("project"));
selectors.addRequest.addEventListener("click", () => openEntry("request"));
selectors.addEvent.addEventListener("click", () => openEntry("event"));
selectors.addMember.addEventListener("click", addMember);
selectors.newMemberName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addMember();
  }
});
selectors.saveEntry.addEventListener("click", saveEntry);

render();
initializeRemoteSync();
