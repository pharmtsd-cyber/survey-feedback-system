const GAS_API = "https://script.google.com/macros/s/AKfycbzB4n24LjIVF316LDnGTkxFDe7byn17vgrpHU_lQEeZww8iR8K7qLDCj4e2NOdm_ulCBw/exec";

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
    
    // 精準控制日期選擇器顯示
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
    
    // 異常卡片：改為手風琴展開模式
    let excHtml = '';
    if(data.exceptionsList.length > 0) {
      data.exceptionsList.forEach((e, i) => {
        let colId = `exc-col-${i}`;
        excHtml += `
          <div class="accordion-item bg-transparent border-bottom border-light">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed bg-transparent text-white p-2" type="button" data-bs-toggle="collapse" data-bs-target="#${colId}">
                <strong class="fs-6 me-2">${e.flowName}</strong> <span class="badge bg-light text-danger ms-auto">${e.flowDept}</span>
              </button>
            </h2>
            <div id="${colId}" class="accordion-collapse collapse" data-bs-parent="#acc-exceptions">
              <div class="accordion-body p-2 pt-0 text-white-50 small">
                <div><i class="bi bi-person"></i> ${e.empName} ｜ <i class="bi bi-clock"></i> ${e.time}</div>
                <div class="mt-2 bg-white text-danger px-2 py-1 rounded fw-bold shadow-sm d-inline-block">${e.qTitle} : ${e.value}</div>
                <div class="mt-2 text-end">
                  <button class="btn btn-sm btn-light text-primary fw-bold shadow-sm" onclick="app.openForm('edit', '${e.flowId}', '${e.flowName}', '${e.recordId}')">前往回覆/修改 <i class="bi bi-arrow-right"></i></button>
                </div>
              </div>
            </div>
          </div>`;
      });
    } else {
      excHtml = '<div class="p-2 text-white">目前區間無異常。</div>';
    }
    document.getElementById('acc-exceptions').innerHTML = excHtml;
      
    document.getElementById('dash-inc-list').innerHTML = data.incompleteFlows.length > 0
      ? data.incompleteFlows.map(f => `<li class="mb-2 fs-6 px-2"><i class="bi bi-x-circle text-danger me-2"></i> ${f.name}</li>`).join('')
      : '<li class="px-2"><i class="bi bi-check-circle text-success fs-5 me-2"></i> 區間內全數完成！</li>';

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
    for(let qId in data) {
      html += `<div class="col-md-6 col-12 mb-4"><div class="card shadow-sm border-0"><div class="card-body"><canvas id="dash-chart-${qId}"></canvas></div></div></div>`;
    }
    container.innerHTML = html; 

    // 強制延遲確保 DOM 完全寫入後才綁定 Canvas
    setTimeout(() => {
      for(let qId in data) {
        let canvas = document.getElementById(`dash-chart-${qId}`);
        if(canvas) {
          let ctx = canvas.getContext('2d');
          this.charts[qId] = new Chart(ctx, {
            type: 'line',
            data: { 
              labels: data[qId].data.map(d => d.time), 
              datasets: [{ label: data[qId].title, data: data[qId].data.map(d => d.value), borderColor: '#0d6efd', backgroundColor: 'rgba(13, 110, 253, 0.1)', fill: true, tension: 0.3 }] 
            },
            options: { responsive: true, plugins: { legend: { position: 'top' } } }
          });
        }
      }
    }, 300);
  },

  async loadCalendar(menuItem) {
    this.setActiveMenu(menuItem);
    this.switchView('view-calendar', '行事曆總覽');
    
    let calendarEl = document.getElementById('calendar-container');
    if (!this.calendar) {
      this.calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth', locale: 'zh-tw', height: 'auto',
        events: async (info, successCallback, failureCallback) => {
          try {
            // FullCalendar startStr 格式為 2023-10-01，我們取前 7 碼 YYYY-MM
            const yearMonth = info.startStr.substring(0, 7); 
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

  async loadDeptFlows(dept, menuItem = null) {
    if(menuItem) this.setActiveMenu(menuItem);
    this.currentDept = dept;
    this.switchView('view-dept-flows', `${dept} 問卷清單`);
    
    const targetDate = document.getElementById('target-date').value;
    const res = await this.api({ action: 'getDeptFlows', department: dept, targetDate: targetDate });
    
    // 渲染上方專屬未完成卡片
    let incHtml = '';
    if(res.incompleteList.length > 0) {
      res.incompleteList.forEach(f => {
        incHtml += `<li class="mb-2 p-2 bg-white rounded shadow-sm d-flex justify-content-between align-items-center">
                      <span class="fw-bold"><i class="bi bi-x-circle text-danger me-2"></i> ${f.name}</span>
                      <button class="btn btn-sm btn-primary fw-bold" onclick="app.openForm('new', '${f.id}', '${f.name}')">前往填寫</button>
                    </li>`;
      });
    } else {
      incHtml = '<li class="p-2 text-success fw-bold"><i class="bi bi-check-circle fs-5 me-2"></i> 本日指定任務全數完成！</li>';
    }
    document.getElementById('dept-inc-list').innerHTML = incHtml;

    // 渲染手風琴分類清單
    let html = '';
    let sortedCategories = Object.keys(res.categories).sort();
    
    sortedCategories.forEach(catName => {
      html += `<h5 class="fw-bold text-primary mt-4 mb-3 border-bottom pb-2"><i class="bi bi-tags"></i> ${catName}</h5>`;
      let flows = res.categories[catName];
      
      flows.forEach((f, index) => {
        let collapseId = `col-${f.id}`;
        if (f.count === 0) {
          html += `
            <div class="card border-0 shadow-sm mb-3">
              <button class="btn btn-light d-flex justify-content-between align-items-center p-3 text-start" onclick="app.openForm('new', '${f.id}', '${f.name}')">
                <strong class="fs-5">${f.name}</strong><span class="badge bg-secondary rounded-pill px-3 fs-6">未完成</span>
              </button>
            </div>`;
        } else {
          let listHtml = '';
          f.records.forEach(r => {
            let badge = r.isException ? `<span class="badge bg-danger shadow-sm">異常</span>` : `<span class="badge bg-success shadow-sm">正常</span>`;
            listHtml += `
              <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3" style="cursor:pointer;" onclick="app.openForm('edit', '${f.id}', '${f.name}', '${r.recordId}')">
                <div>
                  <div class="fw-bold"><i class="bi bi-person text-primary"></i> ${r.empName}</div><small class="text-muted"><i class="bi bi-clock"></i> ${r.time}</small>
                </div>
                ${badge}
              </div>`;
          });

          html += `
            <div class="accordion mb-3 shadow-sm rounded" id="acc-${f.id}">
              <div class="accordion-item border-0">
                <h2 class="accordion-header">
                  <button class="accordion-button collapsed bg-white text-dark rounded" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                    <strong class="fs-5">${f.name}</strong><span class="badge bg-success rounded-pill px-3 ms-auto fs-6">完成 ${f.count} 次</span>
                  </button>
                </h2>
                <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#acc-${f.id}">
                  <div class="accordion-body p-0">
                    <div class="p-3 bg-light text-end"><button class="btn btn-sm btn-outline-primary fw-bold shadow-sm" onclick="app.openForm('new', '${f.id}', '${f.name}')"><i class="bi bi-plus-lg"></i> 新增一筆紀錄</button></div>
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
      let value = ""; let isException = false;
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
        if (fileInput && fileInput.files.length > 0) value = await this.fileToBase64(fileInput.files[0]);
        else if (this.formMode === 'edit') {
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
  }
};
window.onload = () => app.init();
