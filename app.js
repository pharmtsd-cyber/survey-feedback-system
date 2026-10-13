const GAS_API = "https://script.google.com/macros/s/AKfycbzB4n24LjIVF316LDnGTkxFDe7byn17vgrpHU_lQEeZww8iR8K7qLDCj4e2NOdm_ulCBw/exec"; // 替換為你的GAS網址

const app = {
  user: null,
  currentDept: '',
  currentFlow: null,
  formMode: 'new',
  questions: [],
  charts: {},

  init() {
    // 日期選擇器預設為今天
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

  switchView(viewId) {
    document.querySelectorAll('.content-view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
  },

  setActiveMenu(target) {
    document.querySelectorAll('#sidebar ul li').forEach(li => li.classList.remove('active'));
    if(target) target.closest('li').classList.add('active');
  },

  async login() {
    const empId = document.getElementById('login-emp-id').value;
    if(!empId) return alert("請輸入編號");
    this.user = await this.api({ action: 'login', empId });
    document.getElementById('user-info').innerText = `${this.user.empName} (${this.user.empId})`;
    
    // 依據 GAS 回傳的 availableDepts 動態產生側邊選單
    let menuHtml = '';
    this.user.availableDepts.forEach(d => {
      menuHtml += `<li>
                    <a onclick="app.loadDeptFlows('${d}', this)">
                      <i class="bi bi-folder2-open"></i> <span class="sidebar-text">${d}</span>
                    </a>
                   </li>`;
    });
    document.getElementById('dept-menu-container').innerHTML = menuHtml;

    document.getElementById('login-page').style.display = 'none';
    document.getElementById('main-system').style.display = 'block';
    
    // 預設進入首頁總覽
    const homeBtn = document.querySelector('#sidebar ul li a');
    this.loadDashboard(homeBtn);
  },

  refreshCurrentPage() {
    if(document.getElementById('view-dashboard').classList.contains('active')) this.loadDashboard();
    else if(document.getElementById('view-dept-flows').classList.contains('active')) this.loadDeptFlows(this.currentDept);
  },

  async loadDashboard(menuItem = null) {
    if(menuItem) this.setActiveMenu(menuItem);
    this.switchView('view-dashboard');
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    const data = await this.api({ action: 'getDashboard', startDate, endDate, department: this.user.dept });
    
    document.getElementById('dash-exc-count').innerText = data.exceptionCount;
    
    // 渲染異常清單 (包含名稱、登記人、時間、異常數值)
    document.getElementById('dash-exc-list').innerHTML = data.exceptionsList.length > 0 
      ? data.exceptionsList.map(e => `
          <li class="mb-3 border-bottom border-light pb-2">
            <div class="fw-bold">${e.flowName}</div>
            <small class="text-white-50"><i class="bi bi-person"></i> ${e.empName} ｜ <i class="bi bi-clock"></i> ${e.time}</small>
            <div class="mt-1 bg-white text-danger px-2 py-1 rounded d-inline-block fw-bold">異常數值：${e.value}</div>
          </li>`).join('')
      : '<li>目前無異常。</li>';
      
    document.getElementById('dash-inc-list').innerHTML = data.incompleteFlows.length > 0
      ? data.incompleteFlows.map(f => `<li class="mb-2"><i class="bi bi-x-circle text-danger me-2"></i> ${f.name}</li>`).join('')
      : '<li><i class="bi bi-check-circle text-success"></i> 指定區間內全數完成！</li>';

    this.loadDashboardCharts(startDate, endDate);
  },

  async loadDashboardCharts(startDate, endDate) {
    const data = await this.api({ action: 'getTempHistoryByDate', startDate, endDate, department: this.user.dept });
    const container = document.getElementById('dash-charts');
    container.innerHTML = '';
    
    for(let qId in this.charts) { this.charts[qId].destroy(); }

    if(Object.keys(data).length === 0) {
      container.innerHTML = '<div class="col-12"><p class="text-muted">指定區間內無溫度紀錄資料。</p></div>';
      return;
    }

    for(let qId in data) {
      let canvasId = `dash-chart-${qId}`;
      container.innerHTML += `<div class="col-md-6 mb-4"><div class="card shadow-sm border-0"><div class="card-body"><canvas id="${canvasId}"></canvas></div></div></div>`;
    }

    for(let qId in data) {
      let ctx = document.getElementById(`dash-chart-${qId}`).getContext('2d');
      let labels = data[qId].data.map(d => d.time);
      let values = data[qId].data.map(d => d.value);
      
      this.charts[qId] = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: data[qId].title, data: values, borderColor: '#0d6efd', backgroundColor: 'rgba(13, 110, 253, 0.1)', fill: true, tension: 0.3 }] },
        options: { responsive: true, plugins: { legend: { position: 'top' } } }
      });
    }
  },

  async loadDeptFlows(dept, menuItem = null) {
    if(menuItem) this.setActiveMenu(menuItem);
    this.currentDept = dept;
    document.getElementById('dept-title').innerText = `${dept} - 問卷清單`;
    this.switchView('view-dept-flows');
    
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const flows = await this.api({ action: 'getDeptFlows', department: dept, startDate, endDate });
    
    let html = '';
    flows.forEach(f => {
      let statusHtml = f.status === '已完成' 
        ? `<div class="text-end"><span class="badge bg-success rounded-pill px-3">已完成</span><br><small class="text-muted"><i class="bi bi-person"></i> ${f.empName} <i class="bi bi-clock ms-2"></i> ${f.time}</small></div>`
        : `<span class="badge bg-secondary rounded-pill px-3 py-2">未完成</span>`;
      
      let clickAction = f.status === '已完成' 
        ? `app.showActionModal('${f.id}', '${f.name}', '${f.recordId}')` 
        : `app.startNewFlow('${f.id}', '${f.name}')`;

      html += `<button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center mb-3 shadow-sm rounded border-0" onclick="${clickAction}">
                 <strong class="fs-5">${f.name}</strong> ${statusHtml}
               </button>`;
    });
    document.getElementById('dept-flow-list').innerHTML = html;
  },

  showActionModal(flowId, flowName, recordId) {
    this.currentFlow = { id: flowId, name: flowName, recordId: recordId };
    new bootstrap.Modal(document.getElementById('actionModal')).show();
  },

  startNewFlow(flowId, flowName) {
    this.currentFlow = { id: flowId, name: flowName, recordId: null };
    this.openForm('new');
  },

  async openForm(mode) {
    let modal = bootstrap.Modal.getInstance(document.getElementById('actionModal'));
    if(modal) modal.hide();
    
    this.formMode = mode; 
    this.switchView('view-form');
    document.getElementById('form-title').innerText = `${this.currentFlow.name} ${mode==='view'?'(唯讀模式)':''}`;
    
    this.questions = await this.api({ action: 'getQuestions', flowId: this.currentFlow.id });
    
    let oldAnswers = {};
    if(mode === 'edit' || mode === 'view') {
      oldAnswers = await this.api({ action: 'getRecord', recordId: this.currentFlow.recordId });
    }

    const container = document.getElementById('form-container');
    container.innerHTML = '';
    
    this.questions.forEach(q => {
      const isReadonly = mode === 'view' ? 'disabled' : '';
      const val = oldAnswers[q.qId] || '';
      const reqMark = q.isRequired ? `<span class="text-danger ms-1">*</span>` : '';
      
      let html = `<div class="card mb-4 shadow-sm border-0"><div class="card-body"><h5 class="fw-bold mb-3">${q.title} ${reqMark}</h5>`;
      
      if(q.type === '單選') {
        q.options.forEach(opt => {
          const checked = val === opt ? 'checked' : '';
          html += `<div class="form-check mb-2"><input type="radio" name="${q.qId}" value="${opt}" class="form-check-input" ${checked} ${isReadonly}> <label class="form-check-label">${opt}</label></div>`;
        });
      } else if (q.type === '多選') {
        let valArr = val.split(',');
        q.options.forEach(opt => {
          const checked = valArr.includes(opt) ? 'checked' : '';
          html += `<div class="form-check mb-2"><input type="checkbox" name="${q.qId}" value="${opt}" class="form-check-input" ${checked} ${isReadonly}> <label class="form-check-label">${opt}</label></div>`;
        });
      } else if (q.type === '數字' || q.type === '溫度') {
        html += `<input type="number" id="${q.qId}" class="form-control form-control-lg" value="${val}" ${isReadonly}>`;
      } else if (q.type === '照片') {
        if((mode === 'view' || mode === 'edit') && val.startsWith('http')) {
          html += `<div class="mb-2"><img src="${val}" class="img-fluid rounded shadow-sm" style="max-height:200px;"></div>`;
          if (mode === 'edit') html += `<small class="text-muted d-block mb-2">上傳新照片將覆蓋舊照片</small><input type="file" accept="image/*" class="form-control" id="${q.qId}">`;
        } else {
          html += `<input type="file" accept="image/*" class="form-control" id="${q.qId}" ${isReadonly}>`;
        }
      }
      html += `</div></div>`;
      container.innerHTML += html;
    });

    document.getElementById('btn-submit-form').style.display = mode === 'view' ? 'none' : 'block';
  },

  goBack() { this.refreshCurrentPage(); },

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
          // 修改模式下若無上傳新檔案，沿用原圖片DOM的值
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
    if (res.exceptionTriggered) alert("問卷已送出！注意：有數值超出正常區間，已通報異常處理。");
    else alert("問卷儲存成功！");
    
    this.goBack();
  }
};
window.onload = () => app.init();
