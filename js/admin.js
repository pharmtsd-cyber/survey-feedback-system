app.admin = {
  // ✅ 核心防線：重新拉取使用者權限與最新單位，更新側邊欄
  async refreshSidebar() {
    const userData = await app.api({ action: 'login', empId: app.user.empId });
    app.user.availableDepts = userData.availableDepts;
    let menuHtml = '';
    app.user.availableDepts.forEach(d => {
      menuHtml += `<li><a onclick="app.department.loadDeptFlows('${d}', this)"><i class="bi bi-caret-right"></i> <span class="sidebar-text">${d}</span></a></li>`;
    });
    document.getElementById('dept-menu-container').innerHTML = menuHtml;
  },

  async loadAdminFlows(menuItem) {
    if(menuItem) app.setActiveMenu(menuItem);
    app.switchView('view-admin-flows', '維護 FLOW 表單');
    const data = await app.api({ action: 'getAdminData' });
    
    let html = '';
    data.flows.forEach(f => {
      let badge = f.active ? `<span class="badge bg-success">啟用中</span>` : `<span class="badge bg-secondary">已停用</span>`;
      html += `
        <div class="card shadow-sm border-0 mb-3">
          <div class="card-body d-flex justify-content-between align-items-center">
            <div>
              <div class="fw-bold fs-5">${f.name} <small class="text-muted fs-6">(${f.id})</small></div>
              <small class="text-muted">分類: ${f.category} ｜ 單位: ${f.dept} ｜ 排序: ${f.sort}</small>
              <div class="mt-1">${badge}</div>
            </div>
            <div>
              <button class="btn btn-sm btn-outline-primary" onclick='app.admin.adminEditFlow(${JSON.stringify(f)})'><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger" onclick="app.admin.adminDelFlow('${f.id}')"><i class="bi bi-trash"></i></button>
            </div>
          </div>
        </div>`;
    });
    document.getElementById('admin-flows-list').innerHTML = html;
  },

  adminEditFlow(flow = null) {
    const isNew = !flow;
    document.getElementById('adminModalTitle').innerText = isNew ? '新增 FLOW' : '修改 FLOW';
    let id = isNew ? `FLOW_${new Date().getTime()}` : flow.id;
    let name = isNew ? '' : flow.name;
    let dept = isNew ? '' : flow.dept;
    let category = isNew ? '' : flow.category;
    let activeChecked = (!isNew && flow.active) || isNew ? 'checked' : '';

    document.getElementById('adminModalBody').innerHTML = `
      <input type="hidden" id="af-id" value="${id}">
      <div class="mb-3"><label class="form-label fw-bold">表單名稱</label><input type="text" id="af-name" class="form-control" value="${name}"></div>
      <div class="mb-3"><label class="form-label fw-bold">所屬單位</label><input type="text" id="af-dept" class="form-control" value="${dept}" placeholder="通用 或 填寫單位名稱"></div>
      <div class="mb-3"><label class="form-label fw-bold">Flow 分類</label><input type="text" id="af-cat" class="form-control" value="${category}" placeholder="例如: 1_早班"></div>
      <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="af-active" ${activeChecked}><label class="form-check-label">啟用此表單</label></div>
    `;
    document.getElementById('adminModalSaveBtn').onclick = async () => {
      await app.api({ action: 'adminSaveFlow', data: {
        id: document.getElementById('af-id').value, name: document.getElementById('af-name').value, sort: 0,
        dept: document.getElementById('af-dept').value, category: document.getElementById('af-cat').value,
        active: document.getElementById('af-active').checked
      }});
      bootstrap.Modal.getInstance(document.getElementById('adminModal')).hide();
      
      await this.refreshSidebar(); // ✅ 更新側邊欄
      this.loadAdminFlows();
    };
    new bootstrap.Modal(document.getElementById('adminModal')).show();
  },

  async adminDelFlow(id) {
    if(!confirm("確定要刪除嗎？這將會影響既有設定。")) return;
    await app.api({ action: 'adminDeleteFlow', id: id });
    
    await this.refreshSidebar(); // ✅ 更新側邊欄
    this.loadAdminFlows();
  },

  async loadAdminQuestions(menuItem) {
    if(menuItem) app.setActiveMenu(menuItem);
    app.switchView('view-admin-questions', '設計問卷題目');
    const data = await app.api({ action: 'getAdminData' });
    
    let html = '';
    data.questions.forEach(q => {
      let reqBadge = q.req ? `<span class="badge bg-danger ms-2">必填</span>` : '';
      html += `
        <div class="card shadow-sm border-0 mb-2">
          <div class="card-body d-flex justify-content-between align-items-center py-2">
            <div>
              <div><span class="badge bg-primary me-2">${q.type}</span> <span class="fw-bold">${q.title}</span> ${reqBadge}</div>
              <small class="text-muted">Flow ID: ${q.flowId} | 選項: ${q.options || '無'}</small>
            </div>
            <div>
              <button class="btn btn-sm btn-outline-primary" onclick='app.admin.adminEditQuestion(${JSON.stringify(q)})'><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger" onclick="app.admin.adminDelQuestion('${q.id}')"><i class="bi bi-trash"></i></button>
            </div>
          </div>
        </div>`;
    });
    document.getElementById('admin-questions-list').innerHTML = html;
  },

  adminEditQuestion(q = null) {
    const isNew = !q;
    document.getElementById('adminModalTitle').innerText = isNew ? '新增題目' : '修改題目';
    let id = isNew ? `Q_${new Date().getTime()}` : q.id;
    let flowId = isNew ? '' : q.flowId;
    let title = isNew ? '' : q.title;
    let type = isNew ? '單選' : q.type;
    let opts = isNew ? '' : q.options;
    let req = isNew ? false : q.req;

    document.getElementById('adminModalBody').innerHTML = `
      <input type="hidden" id="aq-id" value="${id}">
      <div class="mb-2"><label class="form-label fw-bold">所屬 Flow ID</label><input type="text" id="aq-flow" class="form-control" value="${flowId}"></div>
      <div class="mb-2"><label class="form-label fw-bold">題目名稱</label><input type="text" id="aq-title" class="form-control" value="${title}"></div>
      <div class="mb-2"><label class="form-label fw-bold">題型</label>
        <select id="aq-type" class="form-select">
          <option ${type==='單選'?'selected':''}>單選</option><option ${type==='多選'?'selected':''}>多選</option>
          <option ${type==='數字'?'selected':''}>數字</option><option ${type==='溫度'?'selected':''}>溫度</option>
          <option ${type==='照片'?'selected':''}>照片</option>
        </select>
      </div>
      <div class="mb-3"><label class="form-label fw-bold">選項 (用逗號分隔)</label><input type="text" id="aq-opt" class="form-control" value="${opts}"></div>
      <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="aq-req" ${req?'checked':''}><label class="form-check-label fw-bold text-danger">必填項目</label></div>
    `;
    document.getElementById('adminModalSaveBtn').onclick = async () => {
      await app.api({ action: 'adminSaveQuestion', data: {
        id: document.getElementById('aq-id').value, flowId: document.getElementById('aq-flow').value,
        title: document.getElementById('aq-title').value, type: document.getElementById('aq-type').value,
        options: document.getElementById('aq-opt').value, req: document.getElementById('aq-req').checked
      }});
      bootstrap.Modal.getInstance(document.getElementById('adminModal')).hide();
      this.loadAdminQuestions();
    };
    new bootstrap.Modal(document.getElementById('adminModal')).show();
  },

  async adminDelQuestion(id) {
    if(!confirm("確定刪除此題目嗎？")) return;
    await app.api({ action: 'adminDeleteQuestion', id: id });
    this.loadAdminQuestions();
  }
};
