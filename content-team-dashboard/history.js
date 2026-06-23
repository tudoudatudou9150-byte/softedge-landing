const STORAGE_KEY = "content-team-dashboard-preview";

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
  detailDialog: document.querySelector("#request-detail-dialog"),
  detailTitle: document.querySelector("#detail-title"),
  detailBody: document.querySelector("#detail-body"),
};

function loadHistoryState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      members: stored.members || fallbackMembers,
      requests: stored.requests || [],
      currentWeekKey: stored.week?.currentWeekKey || "",
    };
  } catch {
    return { members: fallbackMembers, requests: [], currentWeekKey: "" };
  }
}

function memberName(id) {
  return historyState.members.find((member) => member.id === id)?.name || "未分配";
}

function getHistoryRequests() {
  return historyState.requests.filter((request) => ["已完成", "归档历史"].includes(request.status));
}

function renderAssigneeFilter() {
  historySelectors.assignee.innerHTML = `
    <option value="">全部执行人</option>
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
    .filter((request) => !assignee || request.assigneeId === assignee)
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
        memberName(request.assigneeId),
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
                <span>执行人：${memberName(request.assigneeId)}</span>
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
      <span><strong>执行人</strong>${memberName(request.assigneeId)}</span>
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
  renderResults();
}

[historySelectors.search, historySelectors.channel, historySelectors.assignee, historySelectors.status].forEach((control) => {
  control.addEventListener("input", renderResults);
  control.addEventListener("change", renderResults);
});

renderAssigneeFilter();
render();
