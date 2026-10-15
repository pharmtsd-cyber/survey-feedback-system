const GAS_API = "https://script.google.com/macros/s/AKfycbzB4n24LjIVF316LDnGTkxFDe7byn17vgrpHU_lQEeZww8iR8K7qLDCj4e2NOdm_ulCBw/exec"; 

window.app = {
  user: null, currentDept: '', currentFlow: null, currentWorkflow: null, formMode: 'new', questions: [],
  cache: { dashboard: {}, deptFlows: {}, calendar: {}, questions: {} },

  init() {
    const twTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Taipei"}));
    const tY = twTime.getFullYear(); const tM = twTime.getMonth(); const tD = twTime.getDate();
    const todayStr = `${tY}-${String(tM + 1).padStart(2, '0')}-${String(tD).padStart(2, '0')}`;
    const lastMonth = new Date(tY, tM - 1, 1);
    const startStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;

    document.getElementById('start-date').value = startStr;
    document.getElementById('end-date').value = todayStr;
    document.getElementById('target-date').value = todayStr;
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

  async forceRefresh() {
    // 1. 清空所有快取
    this.cache = { dashboard: {}, deptFlows: {}, calendar: {}, questions: {} };
    if (app.admin) app.admin.adminDataCache = null;

    // 2. 徹底銷毀第三方套件實例 (行事曆、圖表)，確保強制重新渲染
    if (app.calendar && app.calendar.instance) {
      app.calendar.instance.destroy();
      app.calendar.instance = null;
    }
    if (app.dashboard && app.dashboard.charts) {
      for(let qId in app.dashboard.charts) {
         app.dashboard.charts[qId].destroy();
      }
      app.dashboard.charts = {};
    }

    // 3. 清空所有分頁的 DOM 容器，避免畫面殘留舊資料
    const containers = [
      'dash-exc-list', 'dash-inc-list', 'dash-period-list', 'dash-ondemand-list', 'dash-charts',
      'calendar-container', 'calendar-details-container',
      'dept-exc-list', 'dept-inc-list', 'dept-period-list', 'dept-ondemand-list', 'dept-accordion-container',
      'form-container', 'form-actions'
    ];
    containers.forEach(id => {
      let el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    
    // 清空後台列表
    document.querySelectorAll('.list-container').forEach(el => el.innerHTML = '');

    // 4. 背景靜默重新登入，更新使用者最新權限與左側單位選單
    if(this.user && this.user.empId) {
       try {
         let freshUser = await this.api({ action: 'login', empId: this.user.empId });
         this.user.availableDepts = freshUser.availableDepts;
         let menuHtml = '';
         this.user.availableDepts.forEach(d => {
           menuHtml += `<li><a onclick="app.department.loadDeptFlows('${d}', this)"><i class="bi bi-caret-right"></i> <span class="sidebar-text">${d}</span></a></li>`;
         });
         document.getElementById('dept-menu-container').innerHTML = menuHtml;
       } catch(e) { 
         console.error("權限更新失敗", e); 
       }
    }

    // 5. 重新載入當前畫面
    this.refreshCurrentPage();
  },

  refreshCurrentPage() {
    if(document.getElementById('view-dashboard').classList.contains('active')) app.dashboard.loadDashboard();
    else if(document.getElementById('view-dept-flows').classList.contains('active')) app.department.loadDeptFlows(app.currentDept);
    else if(document.getElementById('view-calendar').classList.contains('active')) app.calendar.loadCalendar();
    else if(document.getElementById('view-admin-workflows').classList.contains('active')) app.admin.loadAdminWorkflows();
    else if(document.getElementById('view-admin-flows').classList.contains('active')) app.admin.loadAdminFlows();
    else if(document.getElementById('view-admin-questions').classList.contains('active')) app.admin.loadAdminQuestions();
  }

  toggleSidebar() { 
    const sidebar = document.getElementById('sidebar');
    if (document.body.classList.contains('mobile-mode') || window.innerWidth <= 768) {
      sidebar.classList.toggle('open');
    } else {
      sidebar.classList.toggle('collapsed'); 
    }
  },

  switchView(viewId, title = '') {
    document.querySelectorAll('.content-view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (title) document.getElementById('page-main-title').innerHTML = title;
    
    const rangeCtrl = document.getElementById('date-range-container');
    const singleCtrl = document.getElementById('date-single-container');
    
    if(viewId === 'view-dashboard' || viewId === 'view-calendar') {
      rangeCtrl.classList.remove('d-none'); singleCtrl.classList.add('d-none');
    } else if (viewId === 'view-dept-flows') {
      rangeCtrl.classList.add('d-none'); singleCtrl.classList.remove('d-none');
    } else {
      rangeCtrl.classList.add('d-none'); singleCtrl.classList.add('d-none');
    }
  },

  setActiveMenu(target) {
    document.querySelectorAll('#sidebar ul li').forEach(li => li.classList.remove('active'));
    if(target) target.closest('li').classList.add('active');
    
    if (document.body.classList.contains('mobile-mode') || window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.remove('open');
    }
  },

  async login(mode) {
    const empId = document.getElementById('login-emp-id').value;
    if(!empId) return alert("請輸入員工編號");
    document.body.className = mode === 'mobile' ? 'mobile-mode' : 'desktop-mode';
    this.user = await this.api({ action: 'login', empId });
    document.getElementById('user-info').innerText = `${this.user.empName}`;
    
    let menuHtml = '';
    this.user.availableDepts.forEach(d => {
      menuHtml += `<li><a onclick="app.department.loadDeptFlows('${d}', this)"><i class="bi bi-caret-right"></i> <span class="sidebar-text">${d}</span></a></li>`;
    });
    document.getElementById('dept-menu-container').innerHTML = menuHtml;

    document.getElementById('login-page').style.display = 'none';
    document.getElementById('main-system').style.display = 'block';
    app.dashboard.loadDashboard(document.querySelector('#sidebar ul li a'));
  },

    logout() {
    if(!confirm("確定要登出嗎？")) return;
    this.user = null; this.currentDept = '';
    this.cache = { dashboard: {}, deptFlows: {}, calendar: {}, questions: {} };
    document.getElementById('login-emp-id').value = '';
    
    document.getElementById('main-system').style.display = 'none';
    document.getElementById('login-page').style.display = 'block';
    document.body.className = 'desktop-mode';
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar').classList.remove('collapsed');
  },
};
window.onload = () => app.init();
