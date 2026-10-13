const GAS_API = "https://script.google.com/macros/s/AKfycbzB4n24LjIVF316LDnGTkxFDe7byn17vgrpHU_lQEeZww8iR8K7qLDCj4e2NOdm_ulCBw/exec";

const app = {
  user: null,
  currentDept: '',
  currentFlow: null,
  formMode: 'new',
  questions: [],
  charts: {},

  init() {
    document.getElementById('global-date').value = new Date().toISOString().split('T')[0];
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
    target.closest('li').classList.add('active');
  },

  async login() {
    const empId = document.getElementById('login-emp-id').value;
    if(!empId) return alert("請輸入編號");
    this.user = await this.api({ action: 'login', empId });
    document.getElementById('user-info').innerText = `${this.user.empName} (${this.user.empId}) - ${this.user.dept}`;
    
    let menuHtml = `<li><a onclick="app.loadDeptFlows('${this.user.dept}', this)"><i class="bi bi-folder2"></i> ${this.user.dept}</a></li>`;
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
    this.switchView('view-dashboard');
    const date = document.getElementById('global-date').value;
    const data = await this.api({ action: 'getDashboard', date, department: this.user.dept });
    
    document.getElementById('dash-exc-count').innerText = data.exceptionCount;
    document.getElementById('dash-exc-list').innerHTML = data.exceptionsList.length > 0 
      ? data.exceptionsList.map(e => `<li><small class="text-white-50">${e.time}</small> 紀錄 <b>${e.recId}</b></li>`).join('')
      : '<li>目前無異常。</li>';
      
    document.getElementById('dash-inc-list').innerHTML = data.incompleteFlows.length > 0
      ? data.incompleteFlows.map(f => `<li><i class="bi bi-dash"></i> ${f.name}</li>`).join('')
      : '<li>全數完成！</li>';

    this.loadDashboardCharts(date);
  },

  async loadDashboardCharts(date) {
    const data = await this.api({ action: 'getTempHistoryByDate', date, department: this.user.dept });
    const container = document.getElementById('dash-charts');
    container.innerHTML = '';
    
    for(let qId in this.charts) { this.charts[qId].destroy(); }

    if(Object.keys(data).length === 0) {
      container.innerHTML = '<div class="col-12"><p class="text-muted">本日無溫度紀錄資料。</p></div>';
      return;
    }

    for(let qId in data) {
      let canvasId = `dash-chart-${qId}`;
      container.innerHTML += `<div class="col-md-6 mb-4"><div class="card shadow-sm"><div class="card-body"><canvas id="${canvasId}"></canvas></div></div></div>`;
    }

    for(let qId in data) {
      let ctx = document.getElementById(`dash-chart-${qId}`).getContext('2d');
      let labels = data[qId].data.map(d => d.time);
      let values = data[qId].data.map(d => d.value);
      
      this.charts[qId] = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: data[qId].title, data: values, borderColor: '#0d6efd', tension: 0.1 }] },
        options: { responsive: true }
      });
    }
  },

  async loadDeptFlows(dept, menuItem = null) {
    if(menuItem) this.setActiveMenu(menuItem);
    this.currentDept = dept;
    document.getElementById('dept-title').innerText = `${dept} - 任務清單`;
    this.switchView('view-dept-flows');
    
    const date = document.getElementById('global-date').value;
    const flows = await this.api({ action: 'getDeptFlows', department: dept, date });
    
    let html = '';
    flows.forEach(f => {
      let statusHtml = f.status === '已完成' 
        ? `<div class="text-end"><span class="badge bg-success">已完成</span><br><small class="text-muted">${f.empName} 於 ${f.time}</small></div>`
        : `<span class="badge bg-secondary">未完成</span>`;
      
      let clickAction = f.status === '已完成' 
        ? `app.showActionModal('${f.id}', '${f.name}', '${f.recordId}')` 
        : `app.startNewFlow('${f.id}', '${f.name}')`;

      html += `<button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center mb-2 shadow-sm rounded" onclick="${clickAction}">
                 <strong>${f.name}</strong> ${statusHtml}
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
    document.getElementById('form-title').innerText = `${this.currentFlow.name} ${mode==='view'?'(唯讀)':''}`;
    
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
      const reqMark = q.isRequired ? `<span class="text-danger">*</span>` : '';
      
      let html = `<div class="card mb-3"><div class="card-body"><h5>${q.title} ${reqMark}</h5>`;
      
      if(q.type === '單選') {
        q.options.forEach(opt => {
          const checked = val === opt ? 'checked' : '';
          html += `<div class="form-check"><input type="radio" name="${q.qId}" value="${opt}" class="form-check-input" ${checked} ${isReadonly}> <label>${opt}</label></div>`;
        });
      } else if (q.type === '多選') {
        let valArr = val.split(',');
        q.options.forEach(opt => {
          const checked = valArr.includes(opt) ? 'checked' : '';
          html += `<div class="form-check"><input type="checkbox" name="${q.qId}" value="${opt}" class="form-check-input" ${checked} ${isReadonly}> <label>${opt}</label></div>`;
        });
      } else if (q.type === '數字' || q.type === '溫度') {
        html += `<input type="number" id="${q.qId}" class="form-control" value="${val}" ${isReadonly}>`;
      } else if (q.type === '照片') {
        if(mode === 'view' && val.startsWith('http')) {
          html += `<img src="${val}" class="img-fluid rounded" style="max-height:200px;">`;
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
        if (fileInput && fileInput.files.length > 0) value = await this.fileToBase64(fileInput.files[0]);
      }
      
      if (q.isRequired && value === "") return alert(`請填寫必填項目：${q.title}`);
      answers.push({ qId: q.qId, value: value, isException: isException });
    }

    const payload = {
      action: 'submitForm', empId: this.user.empId, flowId: this.currentFlow.id, answers: answers,
      recordId: this.formMode === 'edit' ? this.currentFlow.recordId : null // 若為 refill 則傳 null 以新增
    };

    const res = await this.api(payload);
    if (res.exceptionTriggered) alert("問卷已送出！注意：有數值超出正常區間，已通報異常處理。");
    else alert("問卷儲存成功！");
    
    this.goBack();
  }
};
window.onload = () => app.init();
