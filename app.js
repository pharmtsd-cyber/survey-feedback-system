const GAS_API = "https://script.google.com/macros/s/AKfycbzB4n24LjIVF316LDnGTkxFDe7byn17vgrpHU_lQEeZww8iR8K7qLDCj4e2NOdm_ulCBw/exec"; 

const app = {
  user: null, currentDept: '', currentFlow: null, formMode: 'new', questions: [], charts: {},

  init() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('start-date').value = today;
    document.getElementById('end-date').value = today;
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
    document.getElementById('date-filter-container').style.display = (viewId === 'view-form') ? 'none' : 'flex';
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
      menuHtml += `<li><a onclick="app.loadDeptFlows('${d}', this)"><i class="bi bi-folder2-open"></i> <span class="sidebar-text">${d}</span></a></li>`;
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

  // 確保 Chart.js 抓得到畫面上的 Canvas
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

    // 延遲一小段時間確保 DOM 渲染完畢
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
    }, 100);
  },

  async loadDeptFlows(dept, menuItem = null) {
    if(menuItem) this.setActiveMenu(menuItem);
    this.currentDept = dept;
    this.switchView('view-dept-flows', `${dept} 問卷清單`);
    
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const flows = await this.api({ action: 'getDeptFlows', department: dept, startDate, endDate });
    
    let html = '';
    flows.forEach((f, index) => {
      if (f.count === 0) {
        // 未完成：點擊直接進入填寫
        html += `
          <div class="accordion-item mb-3 shadow-sm border-0 rounded">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed bg-white text-dark rounded" type="button" onclick="app.openForm('new', '${f.id}', '${f.name}')">
                <strong class="fs-5">${f.name}</strong>
                <span class="badge bg-secondary rounded-pill px-3 ms-auto">未完成</span>
              </button>
            </h2>
          </div>`;
      } else {
        // 已完成：點擊展開紀錄清單
        let listHtml = '';
        f.records.forEach(r => {
          let badge = r.isException ? `<span class="badge bg-danger ms-auto shadow-sm">狀態: 異常</span>` : `<span class="badge bg-success ms-auto shadow-sm">狀態: 正常</span>`;
          listHtml += `
            <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3 cursor-pointer" onclick="app.openForm('edit', '${f.id}', '${f.name}', '${r.recordId}')">
              <div>
                <div class="fw-bold"><i class="bi bi-person text-primary"></i> ${r.empName}</div>
                <small class="text-muted"><i class="bi bi-clock"></i> ${r.time}</small>
              </div>
              ${badge}
            </div>`;
        });

        html += `
          <div class="accordion-item mb-3 shadow-sm border-0 rounded">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed bg-white text-dark rounded" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${index}">
                <strong class="fs-5">${f.name}</strong>
                <span class="badge bg-success rounded-pill px-3 ms-auto">完成 ${f.count} 次</span>
              </button>
            </h2>
            <div id="collapse-${index}" class="accordion-collapse collapse" data-bs-parent="#dept-accordion">
              <div class="accordion-body p-0">
                <div class="p-3 bg-light text-end">
                  <button class="btn btn-sm btn-outline-primary fw-bold" onclick="app.openForm('new', '${f.id}', '${f.name}')"><i class="bi bi-plus-lg"></i> 新增一筆紀錄</button>
                </div>
                <div class="list-group list-group-flush">${listHtml}</div>
              </div>
            </div>
          </div>`;
      }
    });
    document.getElementById('dept-accordion').innerHTML = html;
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
        html += `<input type="number" id="${q.qId}" class="form-control form-control-lg bg-light border-0 shadow-sm" value="${val}">`;
      } else if (q.type === '照片') {
        if(mode === 'edit' && val.startsWith('http')) {
          html += `<div class="mb-2"><img src="${val}" class="img-fluid rounded shadow-sm" style="max-height:200px;"></div><small class="text-muted d-block mb-2">上傳新照片將覆蓋舊照片</small>`;
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
    if (res.exceptionTriggered) alert("儲存成功！注意：有異常數值，已通報主管處理。");
    else alert("儲存成功！");
    this.goBack();
  },

  // 後台維護功能
  async loadAdmin(menuItem) {
    this.setActiveMenu(menuItem);
    this.switchView('view-admin', '後台維護 (唯讀)');
    const data = await this.api({ action: 'getAdminData' });
    
    document.getElementById('admin-flows-list').innerHTML = data.flows.map(f => 
      `<li class="list-group-item d-flex justify-content-between">
         <span><b>${f.name}</b> <small class="text-muted">(${f.dept})</small></span>
         <span class="badge ${f.active ? 'bg-success' : 'bg-secondary'}">${f.active ? '啟用' : '停用'}</span>
       </li>`
    ).join('');

    document.getElementById('admin-questions-list').innerHTML = data.questions.map(q => 
      `<li class="list-group-item">
         <span class="badge bg-info text-dark me-2">${q.type}</span> <b>${q.title}</b> <small class="text-muted">[所屬 Flow: ${q.flowId}]</small>
       </li>`
    ).join('');
  }
};
window.onload = () => app.init();
