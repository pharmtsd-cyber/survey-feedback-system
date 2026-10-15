app.admin = {
  adminDataCache: null,

  async fetchAdminData() {
    if (!this.adminDataCache) {
       this.adminDataCache = await app.api({ action: 'getAdminData' });
    }
    return this.adminDataCache;
  },

  // ✅ 共用的模糊字串篩選器
  filterList(event, containerId) {
    const term = event.target.value.toLowerCase();
    const items = document.querySelectorAll(`#${containerId} .sortable-item`);
    items.forEach(el => {
      const text = el.innerText.toLowerCase();
      el.style.display = text.includes(term) ? '' : 'none';
    });
  },

  // ✅ 啟用 SortableJS 拖拉排序
  initSortable(containerId, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const options = {
      animation: 150,
      handle: '.drag-handle', // 限定按住左側圖示才能拖拉
      ghostClass: 'bg-light',
      onEnd: () => this.saveSortOrder(type)
    };

    if (type === 'workflows') {
       // 任務流有依單位分組，所以綁定在各自的 Group 內
       const groups = container.querySelectorAll('.sortable-group');
       groups.forEach(group => new Sortable(group, options));
    } else {
       new Sortable(container, options);
    }
  },

  // ✅ 呼叫 API 更新排序
  async saveSortOrder(type) {
    let items;
    if(type === 'workflows') items = document.querySelectorAll('#admin-workflows-list .sortable-item');
    else if(type === 'flows') items = document.querySelectorAll('#admin-flows-list .sortable-item');
    else items = document.querySelectorAll('#admin-questions-list .sortable-item');
    
    // 依據畫面上新的順序收集 ID
    const ids = Array.from(items).map(el => el.dataset.id);
    let sheetName = type === 'workflows' ? 'Workflows' : (type === 'flows' ? 'Flows' : 'Questions');
    
    await app.api({ action: 'adminUpdateSort', sheetName: sheetName, idList: ids });
    this.adminDataCache = null; // 更新排序後清除快取
  },

  // ---------------- 任務流 (Workflows) ----------------
  async loadAdminWorkflows(menuItem) {
    if(menuItem) app.setActiveMenu(menuItem);
    app.switchView('view-admin-workflows', '維護 任務流 (Workflows)');
    const data = await this.fetchAdminData();
    
    let html = `
      <div class="mb-3">
        <input type="text" class="form-control border-primary shadow-sm" placeholder="🔍 模糊搜尋 (輸入名稱、單位、分類或表單ID...)" onkeyup="app.admin.filterList(event, 'admin-workflows-list')">
      </div>
      <div id="admin-workflows-list">
    `;
    
    // ✅ 依「所屬單位」群組化
    let grouped = {};
    data.workflows.forEach(wf => {
      if(!grouped[wf.dept]) grouped[wf.dept] = [];
      grouped[wf.dept].push(wf);
    });

    for (let dept in grouped) {
      html += `<h5 class="fw-bold mt-4 text-primary"><i class="bi bi-building"></i> 單位：${dept || '通用/未指定'}</h5>`;
      html += `<div class="sortable-group">`; // 拖拉區塊
      grouped[dept].forEach(wf => {
        let badge = wf.active ? `<span class="badge bg-success">啟用中</span>` : `<span class="badge bg-secondary">已停用</span>`;
        let scheduleBadge = wf.schedule ? `<span class="badge bg-info text-dark ms-2"><i class="bi bi-calendar-check"></i> 頻率: ${wf.schedule}</span>` : '';
        
        html += `
          <div class="card shadow-sm border-0 mb-2 border-start border-primary border-4 sortable-item" data-id="${wf.id}">
            <div class="card-body d-flex justify-content-between align-items-center py-2">
              <div class="d-flex align-items-center">
                <i class="bi bi-grip-vertical drag-handle text-muted me-3 fs-4" style="cursor: grab;" title="按住拖拉排序"></i>
                <div>
                  <div class="fw-bold fs-5 text-dark">${wf.name} <small class="text-muted fs-6">(${wf.id})</small></div>
                  <small class="text-muted">分類: ${wf.category} ｜ 綁定表單: <span class="text-primary fw-bold">${wf.flowIds}</span></small>
                  <div class="mt-1">${badge} ${scheduleBadge}</div>
                </div>
              </div>
              <div>
                <button class="btn btn-sm btn-outline-primary shadow-sm" onclick='app.admin.adminEditWorkflow(${JSON.stringify(wf)})'><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger shadow-sm" onclick="app.admin.adminDelWorkflow('${wf.id}')"><i class="bi bi-trash"></i></button>
              </div>
            </div>
          </div>`;
      });
      html += `</div>`;
    }
    html += `</div>`;
    
    document.getElementById('view-admin-workflows').querySelector('.list-container').innerHTML = html;
    this.initSortable('admin-workflows-list', 'workflows');
  },

  adminEditWorkflow(wf = null) {
    const isNew = !wf;
    document.getElementById('adminModalTitle').innerText = isNew ? '新增任務流' : '修改任務流';
    let id = isNew ? `WF_${new Date().getTime()}` : wf.id;
    let sort = isNew ? 999 : wf.sort;
    let name = isNew ? '' : wf.name;
    let dept = isNew ? '' : wf.dept;
    let category = isNew ? '' : wf.category;
    let flowIds = isNew ? '' : wf.flowIds;
    let schedule = isNew ? '' : (wf.schedule || '');
    let activeChecked = (!isNew && wf.active) || isNew ? 'checked' : '';

    document.getElementById('adminModalBody').innerHTML = `
      <input type="hidden" id="aw-id" value="${id}">
      <input type="hidden" id="aw-sort" value="${sort}">
      <div class="mb-3"><label class="form-label fw-bold">任務名稱</label><input type="text" id="aw-name" class="form-control border-primary" value="${name}"></div>
      <div class="mb-3"><label class="form-label fw-bold">所屬單位</label><input type="text" id="aw-dept" class="form-control" value="${dept}" placeholder="通用 或 填寫單位名稱"></div>
      <div class="mb-3"><label class="form-label fw-bold">執行頻率 (時間)</label><input type="text" id="aw-schedule" class="form-control" value="${schedule}" placeholder="例如: 每季一次, 每月, W1, 假日"></div>
      <div class="mb-3"><label class="form-label fw-bold">任務分類</label><input type="text" id="aw-cat" class="form-control" value="${category}" placeholder="例如: 每日例行"></div>
      <div class="mb-3"><label class="form-label fw-bold">包含的表單 (Flow ID)</label>
        <input type="text" id="aw-flowids" class="form-control" value="${flowIds}" placeholder="例如: FLOW_1, FLOW_2 (用逗號分隔)">
        <small class="text-muted">填寫子表單的 ID，系統將依照此順序連續導航填寫。</small>
      </div>
      <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="aw-active" ${activeChecked}><label class="form-check-label text-dark fw-bold">啟用此任務</label></div>
    `;
    document.getElementById('adminModalSaveBtn').onclick = async () => {
      await app.api({ action: 'adminSaveWorkflow', data: {
        id: document.getElementById('aw-id').value, name: document.getElementById('aw-name').value, sort: document.getElementById('aw-sort').value,
        dept: document.getElementById('aw-dept').value, category: document.getElementById('aw-cat').value,
        flowIds: document.getElementById('aw-flowids').value, schedule: document.getElementById('aw-schedule').value, active: document.getElementById('aw-active').checked
      }});
      this.adminDataCache = null;
      bootstrap.Modal.getInstance(document.getElementById('adminModal')).hide();
      this.loadAdminWorkflows();
    };
    new bootstrap.Modal(document.getElementById('adminModal')).show();
  },

  async adminDelWorkflow(id) {
    if(!confirm("確定要刪除此任務流嗎？這不會刪除子表單，只會解除綁定關係。")) return;
    await app.api({ action: 'adminDeleteWorkflow', id: id });
    this.adminDataCache = null;
    this.loadAdminWorkflows();
  },

  // ---------------- 子表單 (Flows) 維護 ----------------
  async loadAdminFlows(menuItem) {
    if(menuItem) app.setActiveMenu(menuItem);
    app.switchView('view-admin-flows', '維護 問卷表單 (Forms)');
    const data = await this.fetchAdminData();
    
    let html = `
      <div class="mb-3">
        <input type="text" class="form-control border-info shadow-sm" placeholder="🔍 模糊搜尋 (輸入名稱、備註、被綁定的任務...)" onkeyup="app.admin.filterList(event, 'admin-flows-list')">
      </div>
      <div id="admin-flows-list">
    `;
    
    data.flows.forEach(f => {
      // ✅ 顯示有什麼 Workflow 用到這個表單
      let linkedWfs = data.workflows.filter(w => {
         let ids = w.flowIds.split(',').map(s=>s.trim());
         return ids.includes(f.id);
      }).map(w => w.name).join('、 ');

      let badge = '';
      let rawActive = String(f.active).toLowerCase();
      if (rawActive === '正常' || rawActive === 'true') badge = `<span class="badge bg-success">正常</span>`;
      else if (rawActive === '維修中') badge = `<span class="badge bg-warning text-dark">維修中</span>`;
      else badge = `<span class="badge bg-secondary">關閉</span>`;

      html += `
        <div class="card shadow-sm border-0 mb-2 border-start border-info border-4 sortable-item" data-id="${f.id}">
          <div class="card-body d-flex justify-content-between align-items-center py-2">
            <div class="d-flex align-items-center">
              <i class="bi bi-grip-vertical drag-handle text-muted me-3 fs-4" style="cursor: grab;" title="按住拖拉排序"></i>
              <div>
                <div class="fw-bold fs-5 text-dark">${f.name} <small class="text-muted fs-6">(${f.id})</small></div>
                <small class="text-muted"><i class="bi bi-diagram-2 text-info"></i> 綁定此表單的任務: <span class="text-dark fw-bold">${linkedWfs || '無'}</span></small><br>
                <small class="text-muted"><i class="bi bi-journal-text text-secondary"></i> 備註: ${f.memo || '無'}</small>
                <div class="mt-1">${badge}</div>
              </div>
            </div>
            <div>
              <button class="btn btn-sm btn-outline-primary shadow-sm" onclick='app.admin.adminEditFlow(${JSON.stringify(f)})'><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger shadow-sm" onclick="app.admin.adminDelFlow('${f.id}')"><i class="bi bi-trash"></i></button>
            </div>
          </div>
        </div>`;
    });
    html += `</div>`;
    document.getElementById('view-admin-flows').querySelector('.list-container').innerHTML = html;
    this.initSortable('admin-flows-list', 'flows');
  },

  adminEditFlow(flow = null) {
    const isNew = !flow;
    document.getElementById('adminModalTitle').innerText = isNew ? '新增 表單' : '修改 表單';
    let id = isNew ? `FLOW_${new Date().getTime()}` : flow.id;
    let name = isNew ? '' : flow.name;
    let sort = isNew ? 999 : flow.sort;
    let memo = isNew ? '' : (flow.memo || '');
    
    let activeVal = isNew ? '正常' : String(flow.active).toLowerCase();
    if (activeVal === 'true') activeVal = '正常';
    if (activeVal === 'false') activeVal = '關閉';

    document.getElementById('adminModalBody').innerHTML = `
      <input type="hidden" id="af-id" value="${id}">
      <input type="hidden" id="af-sort" value="${sort}">
      <div class="mb-3"><label class="form-label fw-bold">表單名稱 (如: 冰水主機)</label><input type="text" id="af-name" class="form-control border-info" value="${name}"></div>
      <div class="mb-3"><label class="form-label fw-bold">備註 (原表單分類)</label><input type="text" id="af-memo" class="form-control" value="${memo}" placeholder="內部註記用"></div>
      <div class="mb-3"><label class="form-label fw-bold">表單啟用狀態</label>
        <select id="af-active" class="form-select">
          <option value="正常" ${activeVal==='正常'?'selected':''}>🟢 正常</option>
          <option value="維修中" ${activeVal==='維修中'?'selected':''}>🔧 維修中 (填表時預設關閉題目)</option>
          <option value="關閉" ${activeVal==='關閉'?'selected':''}>❌ 關閉 (完全停用)</option>
        </select>
      </div>
      <p class="mt-3 text-muted small"><i class="bi bi-info-circle"></i> 單位與執行頻率請至「任務流 (Workflows)」中設定。</p>
    `;
    document.getElementById('adminModalSaveBtn').onclick = async () => {
      await app.api({ action: 'adminSaveFlow', data: {
        id: document.getElementById('af-id').value, name: document.getElementById('af-name').value, sort: document.getElementById('af-sort').value,
        dept: '通用', memo: document.getElementById('af-memo').value, active: document.getElementById('af-active').value
      }});
      this.adminDataCache = null;
      bootstrap.Modal.getInstance(document.getElementById('adminModal')).hide();
      this.loadAdminFlows();
    };
    new bootstrap.Modal(document.getElementById('adminModal')).show();
  },

  async adminDelFlow(id) {
    if(!confirm("確定要刪除嗎？建議先確認有無對應的題目與任務流綁定。")) return;
    await app.api({ action: 'adminDeleteFlow', id: id });
    this.adminDataCache = null;
    this.loadAdminFlows();
  },

  // ---------------- 題目維護 ----------------
  async loadAdminQuestions(menuItem) {
    if(menuItem) app.setActiveMenu(menuItem);
    app.switchView('view-admin-questions', '設計問卷題目');
    const data = await this.fetchAdminData();
    
    let html = `
      <div class="mb-3">
        <input type="text" class="form-control border-dark shadow-sm" placeholder="🔍 模糊搜尋 (輸入題目、選項、所屬表單...)" onkeyup="app.admin.filterList(event, 'admin-questions-list')">
      </div>
      <div id="admin-questions-list">
    `;
    
    data.questions.forEach(q => {
      let reqBadge = q.req ? `<span class="badge bg-danger ms-2">必填</span>` : '';
      
      // ✅ 顯示此題目屬於哪個 Flow
      let parentFlow = data.flows.find(fl => fl.id === q.flowId);
      let parentName = parentFlow ? parentFlow.name : "未知表單";

      html += `
        <div class="card shadow-sm border-0 mb-2 sortable-item" data-id="${q.id}">
          <div class="card-body d-flex justify-content-between align-items-center py-2">
            <div class="d-flex align-items-center">
              <i class="bi bi-grip-vertical drag-handle text-muted me-3 fs-4" style="cursor: grab;" title="按住拖拉排序"></i>
              <div>
                <div><span class="badge bg-primary me-2">${q.type}</span> <span class="fw-bold text-dark">${q.title}</span> ${reqBadge}</div>
                <small class="text-muted"><i class="bi bi-file-earmark-text text-dark"></i> 所屬表單: <span class="text-dark fw-bold">${parentName}</span> <span class="text-muted" style="font-size:0.8rem">(${q.flowId})</span></small><br>
                <small class="text-muted"><i class="bi bi-list-check text-secondary"></i> 選項: ${q.options || '無'} ｜ 備註: ${q.memo || '無'}</small>
              </div>
            </div>
            <div>
              <button class="btn btn-sm btn-outline-primary shadow-sm" onclick='app.admin.adminEditQuestion(${JSON.stringify(q)})'><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger shadow-sm" onclick="app.admin.adminDelQuestion('${q.id}')"><i class="bi bi-trash"></i></button>
            </div>
          </div>
        </div>`;
    });
    html += `</div>`;
    document.getElementById('view-admin-questions').querySelector('.list-container').innerHTML = html;
    this.initSortable('admin-questions-list', 'questions');
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
    
    // ✅ 補上遺漏的欄位
    let sort = isNew ? 999 : q.sort;
    let memo = isNew ? '' : (q.memo || '');
    let min = isNew ? '' : (q.min !== null && q.min !== undefined ? q.min : '');
    let max = isNew ? '' : (q.max !== null && q.max !== undefined ? q.max : '');

    document.getElementById('adminModalBody').innerHTML = `
      <input type="hidden" id="aq-id" value="${id}">
      <input type="hidden" id="aq-sort" value="${sort}">
      <div class="mb-2"><label class="form-label fw-bold">綁定表單 ID (Flow ID)</label><input type="text" id="aq-flow" class="form-control border-dark" value="${flowId}"></div>
      <div class="mb-2"><label class="form-label fw-bold">題目名稱</label><input type="text" id="aq-title" class="form-control border-primary" value="${title}"></div>
      <div class="mb-2"><label class="form-label fw-bold">備註 (原題目分類)</label><input type="text" id="aq-memo" class="form-control" value="${memo}"></div>
      
      <div class="mb-2"><label class="form-label fw-bold">題型</label>
        <select id="aq-type" class="form-select">
          <option ${type==='單選'?'selected':''}>單選</option><option ${type==='多選'?'selected':''}>多選</option>
          <option ${type==='數字'?'selected':''}>數字</option><option ${type==='溫度'?'selected':''}>溫度</option>
          <option ${type==='照片'?'selected':''}>照片</option>
        </select>
      </div>
      <div class="mb-2"><label class="form-label fw-bold">選項 (用逗號分隔)</label><input type="text" id="aq-opt" class="form-control" value="${opts}"></div>
      
      <div class="row mb-3">
        <div class="col-6"><label class="form-label fw-bold">正常值下限 <small class="text-muted">(數字/溫度專用)</small></label><input type="number" step="any" id="aq-min" class="form-control" value="${min}"></div>
        <div class="col-6"><label class="form-label fw-bold">正常值上限 <small class="text-muted">(數字/溫度專用)</small></label><input type="number" step="any" id="aq-max" class="form-control" value="${max}"></div>
      </div>
      
      <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="aq-req" ${req?'checked':''}><label class="form-check-label fw-bold text-danger">必填項目</label></div>
    `;
    document.getElementById('adminModalSaveBtn').onclick = async () => {
      await app.api({ action: 'adminSaveQuestion', data: {
        id: document.getElementById('aq-id').value, flowId: document.getElementById('aq-flow').value, sort: document.getElementById('aq-sort').value,
        title: document.getElementById('aq-title').value, type: document.getElementById('aq-type').value, memo: document.getElementById('aq-memo').value,
        options: document.getElementById('aq-opt').value, min: document.getElementById('aq-min').value, max: document.getElementById('aq-max').value, req: document.getElementById('aq-req').checked
      }});
      this.adminDataCache = null;
      bootstrap.Modal.getInstance(document.getElementById('adminModal')).hide();
      this.loadAdminQuestions();
    };
    new bootstrap.Modal(document.getElementById('adminModal')).show();
  },

  async adminDelQuestion(id) {
    if(!confirm("確定刪除此題目嗎？")) return;
    await app.api({ action: 'adminDeleteQuestion', id: id });
    this.adminDataCache = null;
    this.loadAdminQuestions();
  }
};
