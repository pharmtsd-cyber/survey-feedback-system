app.admin = {
  // ---------------- 任務流 (Workflows) ----------------
  async loadAdminWorkflows(menuItem) {
    if(menuItem) app.setActiveMenu(menuItem);
    app.switchView('view-admin-workflows', '維護 任務流 (Workflows)');
    const data = await app.api({ action: 'getAdminData' });
    
    let html = '';
    data.workflows.forEach(wf => {
      let badge = wf.active ? `<span class="badge bg-success">啟用中</span>` : `<span class="badge bg-secondary">已停用</span>`;
      html += `
        <div class="card shadow-sm border-0 mb-3 border-start border-primary border-4">
          <div class="card-body d-flex justify-content-between align-items-center">
            <div>
              <div class="fw-bold fs-5 text-dark">${wf.name} <small class="text-muted fs-6">(${wf.id})</small></div>
              <small class="text-muted">分類: ${wf.category} ｜ 單位: ${wf.dept} ｜ 排序: ${wf.sort}</small>
              <div class="text-primary mt-1 fw-bold" style="font-size:0.9rem;">綁定表單: ${wf.flowIds}</div>
              <div class="mt-1">${badge}</div>
            </div>
            <div>
              <button class="btn btn-sm btn-outline-primary shadow-sm" onclick='app.admin.adminEditWorkflow(${JSON.stringify(wf)})'><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger shadow-sm" onclick="app.admin.adminDelWorkflow('${wf.id}')"><i class="bi bi-trash"></i></button>
            </div>
          </div>
        </div>`;
    });
    document.getElementById('admin-workflows-list').innerHTML = html;
  },

  adminEditWorkflow(wf = null) {
    const isNew = !wf;
    document.getElementById('adminModalTitle').innerText = isNew ? '新增任務流 (Workflow)' : '修改任務流 (Workflow)';
    let id = isNew ? `WF_${new Date().getTime()}` : wf.id;
    let name = isNew ? '' : wf.name;
    let dept = isNew ? '' : wf.dept;
    let category = isNew ? '' : wf.category;
    let flowIds = isNew ? '' : wf.flowIds;
    let activeChecked = (!isNew && wf.active) || isNew ? 'checked' : '';

    document.getElementById('adminModalBody').innerHTML = `
      <input type="hidden" id="aw-id" value="${id}">
      <div class="mb-3"><label class="form-label fw-bold">任務名稱</label><input type="text" id="aw-name" class="form-control" value="${name}"></div>
      <div class="mb-3"><label class="form-label fw-bold">所屬單位</label><input type="text" id="aw-dept" class="form-control" value="${dept}" placeholder="通用 或 填寫單位名稱"></div>
      <div class="mb-3"><label class="form-label fw-bold">任務分類</label><input type="text" id="aw-cat" class="form-control" value="${category}" placeholder="例如: 每日例行"></div>
      <div class="mb-3"><label class="form-label fw-bold">包含的表單 (Flow ID)</label>
        <input type="text" id="aw-flowids" class="form-control border-primary" value="${flowIds}" placeholder="例如: FLOW_1, FLOW_2 (用逗號分隔)">
        <small class="text-muted">填寫子表單的 ID，系統將依照此順序連續導航填寫。</small>
      </div>
      <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="aw-active" ${activeChecked}><label class="form-check-label text-dark fw-bold">啟用此任務</label></div>
    `;
    document.getElementById('adminModalSaveBtn').onclick = async () => {
      await app.api({ action: 'adminSaveWorkflow', data: {
        id: document.getElementById('aw-id').value, name: document.getElementById('aw-name').value, sort: 0,
        dept: document.getElementById('aw-dept').value, category: document.getElementById('aw-cat').value,
        flowIds: document.getElementById('aw-flowids').value, active: document.getElementById('aw-active').checked
      }});
      bootstrap.Modal.getInstance(document.getElementById('adminModal')).hide();
      this.loadAdminWorkflows();
    };
    new bootstrap.Modal(document.getElementById('adminModal')).show();
  },

  async adminDelWorkflow(id) {
    if(!confirm("確定要刪除此任務流嗎？這不會刪除子表單，只會解除綁定關係。")) return;
    await app.api({ action: 'adminDeleteWorkflow', id: id });
    this.loadAdminWorkflows();
  },

  // ---------------- 表單 (Flows) 維護 ----------------
  async loadAdminFlows(menuItem) {
    if(menuItem) app.setActiveMenu(menuItem);
    app.switchView('view-admin-flows', '維護 問卷表單 (Forms)');
    const data = await app.api({ action: 'getAdminData' });
    
    let html = '';
    data.flows.forEach(f => {
      let badge = f.active ? `<span class="badge bg-success">正常</span>` : `<span class="badge bg-secondary">停用</span>`;
      html += `
        <div class="card shadow-sm border-0 mb-3 border-start border-info border-4">
          <div class="card-body d-flex justify-content-between align-items-center">
            <div>
              <div class="fw-bold fs-5 text-dark">${f.name} <small class="text-muted fs-6">(${f.id})</small></div>
              <small class="text-muted">此表單隸屬於設定好的「任務流」中才會被填寫到。</small>
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
    document.getElementById('adminModalTitle').innerText = isNew ? '新增 表單' : '修改 表單';
    let id = isNew ? `FLOW_${new Date().getTime()}` : flow.id;
    let name = isNew ? '' : flow.name;
    let activeChecked = (!isNew && flow.active) || isNew ? 'checked' : '';

    document.getElementById('adminModalBody').innerHTML = `
      <input type="hidden" id="af-id" value="${id}">
      <div class="mb-3"><label class="form-label fw-bold">表單名稱</label><input type="text" id="af-name" class="form-control" value="${name}"></div>
      <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="af-active" ${activeChecked}><label class="form-check-label">啟用此表單</label></div>
      <p class="mt-3 text-muted small"><i class="bi bi-info-circle"></i> 單位與分類請至「任務流 (Workflows)」中設定，這裡只需專心設定表單名稱即可。</p>
    `;
    document.getElementById('adminModalSaveBtn').onclick = async () => {
      await app.api({ action: 'adminSaveFlow', data: {
        id: document.getElementById('af-id').value, name: document.getElementById('af-name').value, sort: 0,
        dept: '通用', category: '子表單', active: document.getElementById('af-active').checked
      }});
      bootstrap.Modal.getInstance(document.getElementById('adminModal')).hide();
      this.loadAdminFlows();
    };
    new bootstrap.Modal(document.getElementById('adminModal')).show();
  },

  async adminDelFlow(id) {
    if(!confirm("確定要刪除嗎？建議先確認有無對應的題目與任務流綁定。")) return;
    await app.api({ action: 'adminDeleteFlow', id: id });
    this.loadAdminFlows();
  },

  // ---------------- 題目維護 ----------------
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
              <div><span class="badge bg-primary me-2">${q.type}</span> <span class="fw-bold text-dark">${q.title}</span> ${reqBadge}</div>
              <small class="text-muted">綁定表單 ID: ${q.flowId} | 選項: ${q.options || '無'}</small>
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
      <div class="mb-2"><label class="form-label fw-bold">綁定表單 ID (Flow ID)</label><input type="text" id="aq-flow" class="form-control border-info" value="${flowId}"></div>
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
