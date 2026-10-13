const GAS_API = "https://script.google.com/macros/s/AKfycbzB4n24LjIVF316LDnGTkxFDe7byn17vgrpHU_lQEeZww8iR8K7qLDCj4e2NOdm_ulCBw/exec";

// 時區安全日期抓取 (回傳 YYYY-MM-DD)
function getLocalToday() {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return new Date(Date.now() - tzOffset).toISOString().split('T')[0];
}

const app = {
  user: null, currentDept: '', currentFlow: null, formMode: 'new', questions: [], charts: {}, calendar: null,

  init() {
    const today = getLocalToday();
    document.getElementById('start-date').value = today;
    document.getElementById('end-date').value = today;
    document.getElementById('target-date').value = today;
  },

  showLoading(show) { document.getElementById('loading').style.display = show ? 'flex' : 'none'; },

  async api(payload) {
    this.showLoading(true);
    try {
      const res = await fetch(GAS_API, { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json();
      this.showLoading(false);
      if (!data.success) throw new Error(data.error);
      return data.data;
    } catch (e) {
      this.showLoading(false);
      alert("系統錯誤: " + e.message);
      throw e;
    }
  },

  toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); },

  switchView(viewId, title = '') {
    document.querySelectorAll('.content-view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (title) document.getElementById('page-main-title').innerText = title;
    
    // 控制頂部日期篩選器的顯示邏輯
    document.getElementById('date-range-container').style.display = (viewId === 'view-dashboard') ? 'flex' : 'none';
    document.getElementById('date-single-container').style.display = (viewId === 'view-dept-flows') ? 'flex' : 'none';
  },

  setActiveMenu(target) {
    document.querySelectorAll('#sidebar ul li').forEach(li => li.classList.remove('active'));
    if(target) target.closest('li').classList.add('active');
  },

  async login(mode) {
    const empId = document.getElementById('login-emp-id').value;
    if(!empId) return alert("請輸入員工編號");
    
    document.body.className = mode === 'mobile' ? 'mobile-mode' : 'desktop-mode';
    this.user = await this.api({ action: 'login', empId });
    document.getElementById('user-info').innerText = `${this.user.empName}`;
    
    let menuHtml = '';
    this.user.availableDepts.forEach(d => {
      menuHtml += `<li><a onclick="app.loadDeptFlows('${d}', this)"><i class="bi bi-caret-right"></i> <span class="sidebar-text">${d}</span></a></li>`;
    });
    document.getElementById('dept-menu-container').innerHTML = menuHtml;

    document.getElementById('login-page').style.display = 'none';
    document.getElementById('main-system').style.display = 'block';
    this.loadDashboard(document.querySelector('#sidebar ul li a'));
  },

  refreshCurrentPage() {
    if(document.getElementById('view-dashboard').classList.contains('active')) this.loadDashboard();
    else if(document.getElementById('view-dept-flows').classList.contains('active')) this.loadDeptFlows(this.currentDept);
  },

  async loadDashboard(menuItem = null) {
    if(menuItem) this.setActiveMenu(menuItem);
    this.switchView('view-dashboard', '系統總覽');
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    const data = await this.api({ action: 'getDashboard', startDate, endDate, department: this.user.dept });
    document.getElementById('dash-exc-count').innerText = data.exceptionCount;
    
    document.getElementById('dash-exc-list').innerHTML = data.exceptionsList.length > 0 
      ? data.exceptionsList.map(e => `
          <li class="mb-3 border-bottom border-light pb-2">
            <div class="fw-bold fs-6 mb-1">${e.flowName}</div>
            <div class="text-white-50 small mb-2"><i class="bi bi-person-fill"></i> ${e.empName} ｜ <i class="bi bi-clock"></i> ${e.time}</div>
            <div class="bg-white text-danger px-2 py-1 rounded d-inline-block fw-bold shadow-sm">${e.qTitle} : ${e.value}</div>
          </li>`).join('')
      : '<li>目前區間無異常。</li>';
      
    document.getElementById('dash-inc-list').innerHTML = data.incompleteFlows.length > 0
      ? data.incompleteFlows.map(f => `<li class="mb-2 fs-6"><i class="bi bi-x-circle text-danger me-2"></i> ${f.name}</li>`).join('')
      : '<li><i class="bi bi-check-circle text-success fs-5 me-2"></i> 指定任務全數完成！</li>';

    this.loadDashboardCharts(startDate, endDate);
  },

  async loadDashboardCharts(startDate, endDate) {
    const data = await this.api({ action: 'getTempHistoryByDate', startDate, endDate, department: this.user.dept });
    const container = document.getElementById('dash-charts');
    for(let qId in this.charts) { this.charts[qId].destroy(); }
    this.charts = {};

    if(Object.keys(data).length === 0) {
      container.innerHTML = '<div class="col-12"><p class="text-muted">指定區間內無溫度紀錄資料。</p></div>';
      return;
    }

    let html = '';
    for(let qId in data) html += `<div class="col-md-6 col-12 mb-4"><div class="card shadow-sm border-0"><div class="card-body"><canvas id="dash-chart-${qId}"></canvas></div></div></div>`;
    container.innerHTML = html; 

    setTimeout(() => {
      for(let qId in data) {
        let canvas = document.getElementById(`dash-chart-${qId}`);
        if(canvas) {
          let ctx = canvas.getContext('2d');
          this.charts[qId] = new Chart(ctx, {
            type: 'line',
            data: { labels: data[qId].data.map(d => d.time), datasets: [{ label: data[qId].title, data: data[qId].data.map(d => d.value), borderColor: '#0d6efd', backgroundColor: 'rgba(13, 110, 253, 0.1)', fill: true, tension: 0.3 }] },
            options: { responsive: true, plugins: { legend: { position: 'top' } } }
          });
        }
      }
    }, 100);
  },

  // 行事曆視圖
  async loadCalendar(menuItem) {
    this.setActiveMenu(menuItem);
    this.switchView('view-calendar', '行事曆總覽');
    
    // 初始化或重新渲染 FullCalendar
    let calendarEl = document.getElementById('calendar-container');
    if (!this.calendar) {
      this.calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'zh-tw',
        events: async (info, successCallback, failureCallback) => {
          try {
            // 抓取當月資料
            const yearMonth = info.startStr.substring(0, 7); // "2023-10"
            const data = await this.api({ action: 'getCalendar', yearMonth: yearMonth, department: this.user.dept });
            successCallback(data);
          } catch(e) { failureCallback(e); }
        }
      });
      this.calendar.render();
    } else {
      this.calendar.refetchEvents();
    }
  },

  // 問卷清單 (單日切換)
  async loadDeptFlows(dept, menuItem = null) {
    if(menuItem) this.setActiveMenu(menuItem);
    this.currentDept = dept;
    this.switchView('view-dept-flows', `${dept} 問卷清單`);
    
    const targetDate = document.getElementById('target-date').value;
    const categoriesData = await this.api({ action: 'getDeptFlows', department: dept, targetDate: targetDate });
    
    let html = '';
    let sortedCategories = Object.keys(categoriesData).sort();
    
    sortedCategories.forEach(catName => {
      html += `<h5 class="fw-bold text-primary mt-4 mb-3 border-bottom pb-2"><i class="bi bi-tags"></i> ${catName}</h5>`;
      let flows = categoriesData[catName];
      
      flows.forEach((f, index) => {
        let collapseId = `col-${f.id}`;
        if (f.count === 0) {
          html += `
            <div class="card border-0 shadow-sm mb-3">
              <button class="btn btn-light d-flex justify-content-between align-items-center p-3 text-start" onclick="app.openForm('new', '${f.id}', '${f.name}')">
                <strong class="fs-5">${f.name}</strong>
                <span class="badge bg-secondary rounded-pill px-3 fs-6">未完成</span>
              </button>
            </div>`;
        } else {
          let listHtml = '';
          f.records.forEach(r => {
            let badge = r.isException ? `<span class="badge bg-danger shadow-sm">異常</span>` : `<span class="badge bg-success shadow-sm">正常</span>`;
            listHtml += `
              <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3" style="cursor:pointer;" onclick="app.openForm('edit', '${f.id}', '${f.name}', '${r.recordId}')">
                <div>
                  <div class="fw-bold"><i class="bi bi-person text-primary"></i> ${r.empName}</div>
                  <small class="text-muted"><i class="bi bi-clock"></i> ${r.time}</small>
                </div>
                ${badge}
              </div>`;
          });

          html += `
            <div class="accordion mb-3 shadow-sm rounded" id="acc-${f.id}">
              <div class="accordion-item border-0">
                <h2 class="accordion-header">
                  <button class="accordion-button collapsed bg-white text-dark rounded" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                    <strong class="fs-5">${f.name}</strong>
                    <span class="badge bg-success rounded-pill px-3 ms-auto fs-6">完成 ${f.count} 次</span>
                  </button>
                </h2>
                <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#acc-${f.id}">
                  <div class="accordion-body p-0">
                    <div class="p-3 bg-light text-end">
                      <button class="btn btn-sm btn-outline-primary fw-bold shadow-sm" onclick="app.openForm('new', '${f.id}', '${f.name}')"><i class="bi bi-plus-lg"></i> 新增一筆紀錄</button>
                    </div>
                    <div class="list-group list-group-flush">${listHtml}</div>
                  </div>
                </div>
              </div>
            </div>`;
        }
      });
    });
    document.getElementById('dept-accordion-container').innerHTML = html || '<p class="text-muted mt-3">此單位尚未設定問卷。</p>';
  },

  async openForm(mode, flowId, flowName, recordId = null) {
    this.formMode = mode;
    this.currentFlow = { id: flowId, name: flowName, recordId: recordId };
    
    this.switchView('view-form', `${flowName} ${mode === 'edit' ? '(修改紀錄)' : ''}`);
    document.getElementById('btn-delete-form').style.display = mode === 'edit' ? 'block' : 'none';
    
    this.questions = await this.api({ action: 'getQuestions', flowId: flowId });
    let oldAnswers = {};
    if(mode === 'edit') oldAnswers = await this.api({ action: 'getRecord', recordId: recordId });

    const container = document.getElementById('form-container');
    container.innerHTML = '';
    
    this.questions.forEach(q => {
      const val = oldAnswers[q.qId] || '';
      const reqMark = q.isRequired ? `<span class="text-danger ms-1">*</span>` : '';
      let html = `<div class="card mb-4 shadow-sm border-0"><div class="card-body"><h5 class="fw-bold mb-3">${q.title} ${reqMark}</h5>`;
      
      if(q.type === '單選') {
        q.options.forEach(opt => {
          const checked = val === opt ? 'checked' : '';
          html += `<div class="form-check mb-2"><input type="radio" name="${q.qId}" value="${opt}" class="form-check-input" ${checked}> <label class="form-check-label">${opt}</label></div>`;
        });
      } else if (q.type === '多選') {
        let valArr = val.split(',');
        q.options.forEach(opt => {
          const checked = valArr.includes(opt) ? 'checked' : '';
          html += `<div class="form-check mb-2"><input type="checkbox" name="${q.qId}" value="${opt}" class="form-check-input" ${checked}> <label class="form-check-label">${opt}</label></div>`;
        });
      } else if (q.type === '數字' || q.type === '溫度') {
        html += `<input type="number" step="any" id="${q.qId}" class="form-control form-control-lg bg-light border-0 shadow-sm" value="${val}">`;
      } else if (q.type === '照片') {
        if(mode === 'edit' && val.startsWith('http')) {
          html += `<div class="mb-2"><img src="${val}" class="img-fluid rounded shadow-sm" style="max-height:200px;"></div><small class="text-muted d-block mb-2">上傳新照將覆蓋</small>`;
        }
        html += `<input type="file" accept="image/*" class="form-control" id="${q.qId}">`;
      }
      html += `</div></div>`;
      container.innerHTML += html;
    });
  },

  goBack() { 
    if(this.currentDept) this.loadDeptFlows(this.currentDept);
    else this.loadDashboard();
  },

  async deleteRecord() {
    if(!confirm("確定要刪除這筆紀錄嗎？刪除後無法還原。")) return;
    await this.api({ action: 'deleteRecord', recordId: this.currentFlow.recordId });
    alert("紀錄已刪除！");
    this.goBack();
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader(); r.readAsDataURL(file);
      r.onload = () => resolve(r.result); r.onerror = e => reject(e);
    });
  },

  async submitForm() {
    let answers = [];
    for (const q of this.questions) {
      let value = "";
      let isException = false;

      if (q.type === '單選') {
        const c = document.querySelector(`input[name="${q.qId}"]:checked`);
        if(c) value = c.value;
      } else if (q.type === '多選') {
        const c = document.querySelectorAll(`input[name="${q.qId}"]:checked`);
        if(c.length > 0) value = Array.from(c).map(cb => cb.value).join(',');
      } else if (q.type === '數字' || q.type === '溫度') {
        value = document.getElementById(q.qId).value;
        if (value !== "") {
          const numVal = Number(value);
          if ((q.min !== null && numVal < q.min) || (q.max !== null && numVal > q.max)) isException = true;
        }
      } else if (q.type === '照片') {
        const fileInput = document.getElementById(q.qId);
        if (fileInput && fileInput.files.length > 0) {
          value = await this.fileToBase64(fileInput.files[0]);
        } else if (this.formMode === 'edit') {
          const existingImg = fileInput ? fileInput.parentElement.querySelector('img') : null;
          if (existingImg) value = existingImg.src;
        }
      }
      
      if (q.isRequired && value === "") return alert(`請填寫必填項目：${q.title}`);
      answers.push({ qId: q.qId, value: value, isException: isException });
    }

    const payload = {
      action: 'submitForm', empId: this.user.empId, flowId: this.currentFlow.id, answers: answers,
      recordId: this.formMode === 'edit' ? this.currentFlow.recordId : null
    };

    const res = await this.api(payload);
    if (res.exceptionTriggered) alert("儲存成功！注意：有異常數值，已通報處理。");
    else alert("儲存成功！");
    this.goBack();
  },

  // ------------- 後台功能 (Web CRUD) -------------
  async loadAdminFlows(menuItem) {
    this.setActiveMenu(menuItem);
    this.switchView('view-admin-flows', '維護 FLOW');
    const data = await this.api({ action: 'getAdminData' });
    
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
              <button class="btn btn-sm btn-outline-primary" onclick='app.adminEditFlow(${JSON.stringify(f)})'><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger" onclick="app.adminDelFlow('${f.id}')"><i class="bi bi-trash"></i></button>
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
      <div class="mb-3"><label class="form-label fw-bold">所屬單位</label><input type="text" id="af-dept" class="form-control" value="${dept}" placeholder="通用 或 特定單位"></div>
      <div class="mb-3"><label class="form-label fw-bold">Flow 分類</label><input type="text" id="af-cat" class="form-control" value="${category}" placeholder="例如: 1_早班"></div>
      <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="af-active" ${activeChecked}><label class="form-check-label">啟用此表單</label></div>
    `;
    document.getElementById('adminModalSaveBtn').onclick = async () => {
      await this.api({ action: 'adminSaveFlow', data: {
        id: document.getElementById('af-id').value, name: document.getElementById('af-name').value, sort: 0,
        dept: document.getElementById('af-dept').value, category: document.getElementById('af-cat').value,
        active: document.getElementById('af-active').checked
      }});
      bootstrap.Modal.getInstance(document.getElementById('adminModal')).hide();
      this.loadAdminFlows();
    };
    new bootstrap.Modal(document.getElementById('adminModal')).show();
  },

  async adminDelFlow(id) {
    if(!confirm("確定要刪除嗎？")) return;
    await this.api({ action: 'adminDeleteFlow', id: id });
    this.loadAdminFlows();
  },

  async loadAdminQuestions(menuItem) {
    this.setActiveMenu(menuItem);
    this.switchView('view-admin-questions', '設計問卷題目');
    const data = await this.api({ action: 'getAdminData' });
    
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
              <button class="btn btn-sm btn-outline-primary" onclick='app.adminEditQuestion(${JSON.stringify(q)})'><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger" onclick="app.adminDelQuestion('${q.id}')"><i class="bi bi-trash"></i></button>
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
      <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="aq-req" ${req?'checked':''}><label class="form-check-label fw-bold text-danger">必填</label></div>
    `;
    document.getElementById('adminModalSaveBtn').onclick = async () => {
      await this.api({ action: 'adminSaveQuestion', data: {
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
    await this.api({ action: 'adminDeleteQuestion', id: id });
    this.loadAdminQuestions();
  }
};
window.onload = () => app.init();
