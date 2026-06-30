const STORAGE_KEY = "content-team-dashboard-preview";
const SUPABASE_URL = "https://vcxetbbpigobkekqzmoy.supabase.co";
const SUPABASE_KEY = "sb_publishable_n6nVRvL9i5DgDUeEMp-ikw_TszSFoiF";
const SUPABASE_TABLE = "content_dashboard_state";
const REMOTE_STATE_ID = "main";
const dayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const fallbackMembers = [
  { id: "m1", name: "王敬文" },
  { id: "m2", name: "朱耀赞" },
  { id: "m3", name: "张学辉" },
  { id: "m4", name: "赖锐捷" },
];

let historyState = loadHistoryState();

const historySelectors = {
  summary: document.querySelector("#archive-summary"),
  results: document.querySelector("#history-results"),
  count: document.querySelector("#result-count"),
  search: document.querySelector("#history-search"),
  channel: document.querySelector("#history-channel"),
  assignee: document.querySelector("#history-assignee"),
  status: document.querySelector("#history-status"),
  weekDate: document.querySelector("#week-date"),
  weekSummary: document.querySelector("#week-summary"),
  weekResults: document.querySelector("#week-results"),
  detailDialog: document.querySelector("#request-detail-dialog"),
  detailTitle: document.querySelector("#detail-title"),
  detailBody: document.querySelector("#detail-body"),
};

function loadHistoryState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      members: stored.members || fallbackMembers,
      week: stored.week || {},
      projects: stored.projects || [],
      events: stored.events || [],
      requests: stored.requests || [],
      weeklyArchives: stored.weeklyArchives || [],
      currentWeekKey: stored.week?.currentWeekKey || "",
    };
  } catch {
    return { members: fallbackMembers, week: {}, projects: [], events: [], requests: [], weeklyArchives: [], currentWeekKey: "" };
  }
}

function remoteHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };
}

async function loadRemoteHistoryState() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.${REMOTE_STATE_ID}&select=data`, {
      headers: remoteHeaders(),
    });
    if (!response.ok) throw new Error(`读取共享历史失败：${response.status}`);

    const rows = await response.json();
    const remoteState = rows[0]?.data;
    if (!remoteState) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteState));
    historyState = loadHistoryState();
    renderAssigneeFilter();
    render();
  } catch (error) {
    console.error(error);
  }
}

function memberName(id) {
  return historyState.members.find((member) => member.id === id)?.name || "未分配";
}

function getAssigneeIds(item) {
  return item.assigneeIds || (item.assigneeId ? [item.assigneeId] : []);
}

function getOwnerIds(item) {
  return item.ownerIds || (item.ownerId ? [item.ownerId] : []);
}

function assigneeNames(item) {
  const names = getAssigneeIds(item).map(memberName).filter((name) => name !== "未分配");
  return names.length ? names.join("、") : "未分配";
}

function ownerNames(item, members = historyState.members) {
  const names = getOwnerIds(item)
    .map((id) => members.find((member) => member.id === id)?.name || "未分配")
    .filter((name) => name !== "未分配");
  return names.length ? names.join("、") : "未分配";
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekKey(date) {
  const target = new Date(date);
  const day = target.getDay() || 7;
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() - day + 1);
  return getDateKey(target);
}

function getWeekEndKey(weekKey, workdays = 6) {
  const date = new Date(`${weekKey}T00:00:00`);
  date.setDate(date.getDate() + Number(workdays || 6) - 1);
  return getDateKey(date);
}

function projectDayLabel(project) {
  const day = Number(project.day || 0);
  if (day) return dayLabels[day - 1] || `第 ${day} 天`;
  return project.due || "未填写日期";
}

function getHistoryRequests() {
  return historyState.requests.filter((request) => ["已完成", "归档历史"].includes(request.status));
}

function getScheduledRequestsForWeek(weekKey) {
  return historyState.requests
    .filter((request) => ["已接收", "排期中", "已完成"].includes(request.status) && request.weekKey === weekKey)
    .map((request) => ({
      ...request,
      assigneeIds: getAssigneeIds(request),
    }));
}

function getCurrentWeekArchive() {
  return {
    id: `week-${historyState.currentWeekKey}`,
    label: "本周实时记录",
    weekKey: historyState.currentWeekKey,
    week: historyState.week || {},
    members: historyState.members,
    projects: historyState.projects.map((project) => ({
      ...project,
      ownerIds: getOwnerIds(project),
    })),
    requests: getScheduledRequestsForWeek(historyState.currentWeekKey),
    events: historyState.events || [],
  };
}

function getSelectedWeekArchive() {
  const dateValue = historySelectors.weekDate.value || getDateKey(new Date());
  const weekKey = getWeekKey(new Date(`${dateValue}T00:00:00`));
  if (weekKey === historyState.currentWeekKey) return getCurrentWeekArchive();
  return (historyState.weeklyArchives || []).find((archive) => archive.weekKey === weekKey) || {
    id: `week-${weekKey}`,
    label: "暂无记录",
    weekKey,
    week: { workdays: 6 },
    members: historyState.members,
    projects: [],
    requests: [],
    events: [],
  };
}

function renderAssigneeFilter() {
  historySelectors.assignee.innerHTML = `
    <option value="">全部制作人</option>
    ${historyState.members.map((member) => `<option value="${member.id}">${member.name}</option>`).join("")}
  `;
}

function getFilteredRequests() {
  const keyword = historySelectors.search.value.trim().toLowerCase();
  const channel = historySelectors.channel.value;
  const assignee = historySelectors.assignee.value;
  const status = historySelectors.status.value;

  return getHistoryRequests()
    .filter((request) => !channel || request.channel === channel)
    .filter((request) => !assignee || getAssigneeIds(request).includes(assignee))
    .filter((request) => !status || request.status === status)
    .filter((request) => {
      if (!keyword) return true;
      const text = [
        request.name,
        request.requester,
        request.channel,
        request.requestTopic,
        request.type,
        request.note,
        assigneeNames(request),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(keyword);
    })
    .reverse();
}

function renderSummary() {
  const requests = getHistoryRequests();
  const completed = requests.filter((request) => request.status === "已完成").length;
  const archived = requests.filter((request) => request.status === "归档历史").length;
  const units = requests.reduce((total, request) => total + Number(request.units || 0), 0);
  const weeklyCount = (historyState.weeklyArchives || []).length + (historyState.currentWeekKey ? 1 : 0);

  historySelectors.summary.innerHTML = `
    <article>
      <span>收录需求</span>
      <strong>${requests.length}</strong>
    </article>
    <article>
      <span>内容条数</span>
      <strong>${units}</strong>
    </article>
    <article>
      <span>本周完成</span>
      <strong>${completed}</strong>
    </article>
    <article>
      <span>归档历史</span>
      <strong>${archived}</strong>
    </article>
    <article>
      <span>周记录</span>
      <strong>${weeklyCount}</strong>
    </article>
  `;
}

function renderWeekArchive() {
  const archive = getSelectedWeekArchive();
  const members = archive.members || historyState.members;
  const workdays = Number(archive.week?.workdays || 6);
  const projectUnits = (archive.projects || []).reduce((total, project) => total + Number(project.units || 0), 0);
  const requestUnits = (archive.requests || []).reduce((total, request) => total + Number(request.units || 0), 0);
  const eventUnits = (archive.events || []).reduce((total, event) => total + Number(event.units || 0), 0);

  historySelectors.weekSummary.innerHTML = `
    <article>
      <span>查看周</span>
      <strong>${archive.weekKey}</strong>
      <small>${archive.weekKey} 至 ${getWeekEndKey(archive.weekKey, workdays)}</small>
    </article>
    <article>
      <span>自主安排</span>
      <strong>${archive.projects?.length || 0}</strong>
      <small>${projectUnits} 条</small>
    </article>
    <article>
      <span>已排需求</span>
      <strong>${archive.requests?.length || 0}</strong>
      <small>${requestUnits} 条</small>
    </article>
    <article>
      <span>日程占用</span>
      <strong>${archive.events?.length || 0}</strong>
      <small>扣减 ${eventUnits} 条</small>
    </article>
  `;

  const projectCards = (archive.projects || [])
    .map(
      (project) => `
        <article class="week-card">
          <span class="tag">${projectDayLabel(project)}</span>
          <h3>${project.name || "未命名安排"}</h3>
          <p>${project.type || "自主安排"} · ${project.units || 0} 条 · ${project.status || "待开始"}</p>
          <small>成员：${ownerNames(project, members)}</small>
        </article>
      `
    )
    .join("");

  const requestCards = (archive.requests || [])
    .map(
      (request) => `
        <article class="week-card">
          <span class="tag">${request.channel || "未选择渠道"}</span>
          <h3>${request.name || "未命名需求"}</h3>
          <p>${request.type || "视频需求"} · ${request.units || 0} 条 · ${request.status || "已排"}</p>
          <small>制作人：${assigneeNames(request)}</small>
        </article>
      `
    )
    .join("");

  const eventCards = (archive.events || [])
    .map(
      (event) => `
        <article class="week-card">
          <span class="tag">${dayLabels[Number(event.day || 1) - 1] || "未填日期"}</span>
          <h3>${event.type || "日程占用"}</h3>
          <p>扣 ${event.units || 0} 条 · ${event.note || "暂无备注"}</p>
          <small>成员：${members.find((member) => member.id === event.memberId)?.name || "未分配"}</small>
        </article>
      `
    )
    .join("");

  historySelectors.weekResults.innerHTML = `
    <section>
      <h3>内容组自主安排</h3>
      <div class="week-card-grid">${projectCards || '<article class="empty-card">这一周暂无自主安排记录</article>'}</div>
    </section>
    <section>
      <h3>需求池已排内容</h3>
      <div class="week-card-grid">${requestCards || '<article class="empty-card">这一周暂无已排需求记录</article>'}</div>
    </section>
    <section>
      <h3>成员日程占用</h3>
      <div class="week-card-grid">${eventCards || '<article class="empty-card">这一周暂无日程占用记录</article>'}</div>
    </section>
  `;
}

function renderResults() {
  const requests = getFilteredRequests();
  historySelectors.count.textContent = `共 ${requests.length} 条`;

  historySelectors.results.innerHTML = requests.length
    ? requests
        .map(
          (request) => `
            <button class="history-card history-card-button" data-history-detail="${request.id}" type="button">
              <header>
                <div>
                  <h3>${request.name}</h3>
                  <p>${request.requester || "未署名"} · ${request.channel || "未选择渠道"} · ${request.type || "视频需求"}</p>
                </div>
                <span class="status-tag ${request.status === "已完成" ? "status-done" : "status-archive"}">${request.status}</span>
              </header>
              <div class="history-meta">
                <span>${request.units || 0} 条</span>
                <span>制作人：${assigneeNames(request)}</span>
                <span>交付：${request.due || "未填写"}</span>
                <span>${request.weekKey === historyState.currentWeekKey ? "本周完成" : "历史归档"}</span>
              </div>
              <p>${request.note || "暂无备注"}</p>
            </button>
          `
        )
        .join("")
    : '<article class="empty-card">暂无符合条件的历史需求</article>';

  document.querySelectorAll("[data-history-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const request = historyState.requests.find((item) => item.id === button.dataset.historyDetail);
      openRequestDetail(request);
    });
  });
}

function openRequestDetail(request) {
  if (!request) return;
  historySelectors.detailTitle.textContent = request.name;
  historySelectors.detailBody.innerHTML = `
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
  historySelectors.detailDialog.showModal();
}

function render() {
  historyState = loadHistoryState();
  renderSummary();
  renderWeekArchive();
  renderResults();
}

[historySelectors.search, historySelectors.channel, historySelectors.assignee, historySelectors.status].forEach((control) => {
  control.addEventListener("input", renderResults);
  control.addEventListener("change", renderResults);
});

historySelectors.weekDate.value = getDateKey(new Date());
historySelectors.weekDate.addEventListener("change", renderWeekArchive);

renderAssigneeFilter();
render();
loadRemoteHistoryState();
