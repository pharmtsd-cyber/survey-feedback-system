const GAS_API = "請貼上你的_GAS_網址";

const app = {
  user: null,
  currentDept: '',
  currentFlow: null, // { id, name, recordId }
  formMode: 'new', // new, edit, view
  questions: [],
  
  init() {
    // 預設日期為今天
    document.getElementById('global-date').value = new Date().toISOString().split('T')[0];
  },

  async api(payload) {
    const res = await fetch(GAS_API, { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  },

  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
  },

  switchView(viewId) {
    document.querySelectorAll('#content .page-view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
  },

  async login() {
    const empId = document.getElementById('login-emp-id').value;
    if(!empId) return alert("請輸入編號");
    try {
      this.user = await this.api({ action: 'login', empId });
      document.getElementById('user-info').innerText = `${this.user.empName} (${this.user.empId})`;
      
      // 動態生成左側單位選單 (可依需求寫死或抓資料庫)
      const depts = ['藥品調劑科', '門診藥局'];
      let menuHtml = '';
      depts.forEach(d => {
        menuHtml += `<li><a onclick="app.loadDeptFlows('${d}')"><i class="bi bi-folder2"></i> ${d}</a></li>`;
      });
      document.getElementById('dept-menu-container').innerHTML = menuHtml;

      document.getElementById('login-page').style.display = 'none';
      document.getElementById('main-system').style.display = 'block';
      this.loadDashboard();
    } catch (e) { alert(e.message); }
  },

  refreshCurrentPage() {
    if(document.getElementById('view-dashboard').classList.contains('active')) this.loadDashboard();
    else if(document.getElementById('view-dept-flows').classList.contains('active')) this.loadDeptFlows(this.currentDept);
  },

  async loadDashboard() {
    this.switchView('view-dashboard');
    const date = document.getElementById('global-date').value;
    const data = await this.api({ action: 'getDashboard', date, department: this.user.dept });
    
    document.getElementById('dash-exc-count').innerText = data.exceptionCount;
    document.getElementById('dash-exc-list').innerHTML = data.exceptionsList.map(e => `<li>- 紀錄 ${e.recId} 有異常</li>`).join('');
    document.getElementById('dash-inc-list').innerHTML = data.incompleteFlows.map(f => `<li>- ${f.name}</li>`).join('');
  },

  async loadDeptFlows(dept) {
    this.currentDept = dept;
    document.getElementById('dept-title').innerText = `${dept} - 任務清單`;
    this.switchView('view-dept-flows');
    
    const date = document.getElementById('global-date').value;
    const flows = await this.api({ action: 'getDeptFlows', department: dept, date });
    
    let html = '';
    flows.forEach(f => {
      const badge = f.status === '已完成' ? `<span class="badge bg-success">已完成 (${f.empName})</span>` : `<span class="badge bg-secondary">未完成</span>`;
      // 如果已完成，點擊後觸發 Modal；若未完成，直接進入新填寫
      const clickAction = f.status === '已完成' 
        ? `app.showActionModal('${f.id}', '${f.name}', '${f.recordId}')` 
        : `app.startNewFlow('${f.id}', '${f.name}')`;

      html += `<button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onclick="${clickAction}">
                 ${f.name} ${badge}
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
    bootstrap.Modal.getInstance(document.getElementById('actionModal'))?.hide();
    this.formMode = mode; // 'new', 'edit', 'view'
    this.switchView('view-form');
    document.getElementById('form-title').innerText = `${this.currentFlow.name} ${mode==='view'?'(唯讀)':''}`;
    
    this.questions = await this.api({ action: 'getQuestions', flowId: this.currentFlow.id });
    
    // 如果是 edit 或 view，需抓取舊答案填入
    let oldAnswers = {};
    if(mode === 'edit' || mode === 'view') {
      oldAnswers = await this.api({ action: 'getRecord', recordId: this.currentFlow.recordId });
    }

    const container = document.getElementById('form-container');
    container.innerHTML = '';
    
    this.questions.forEach(q => {
      const isReadonly = mode === 'view' ? 'disabled' : '';
      const val = oldAnswers[q.qId] || '';
      
      let html = `<div class="card mb-3"><div class="card-body"><h5>${q.title}</h5>`;
      
      if(q.type === '單選') {
        q.options.forEach(opt => {
          const checked = val === opt ? 'checked' : '';
          html += `<div class="form-check"><input type="radio" name="${q.qId}" value="${opt}" class="form-check-input" ${checked} ${isReadonly}> <label>${opt}</label></div>`;
        });
      } else if (q.type === '數字' || q.type === '溫度') {
        html += `<input type="number" id="${q.qId}" class="form-control" value="${val}" ${isReadonly}>`;
      }
      html += `</div></div>`;
      container.innerHTML += html;
    });

    document.getElementById('btn-submit-form').style.display = mode === 'view' ? 'none' : 'block';
  },

  goBack() {
    this.refreshCurrentPage();
  },

  async submitForm() {
    // 這裡放入原本的防呆與打包資料邏輯，然後呼叫 api('submitForm')
    // 為了精簡範例，此處省略 DOM 抓值邏輯，概念與先前完全相同
    alert("送出功能已呼叫 API，邏輯同前。");
    this.goBack();
  }
};

window.onload = () => app.init();
