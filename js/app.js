const GAS_API = "https://script.google.com/macros/s/AKfycbzB4n24LjIVF316LDnGTkxFDe7byn17vgrpHU_lQEeZww8iR8K7qLDCj4e2NOdm_ulCBw/exec"; 

window.app = {
  user: null, currentDept: '', currentFlow: null, formMode: 'new', questions: [],
  cache: { dashboard: null, deptFlows: null, calendar: null }, // ✅ 快取機制

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

  // ✅ 手動強制更新 (清除快取)
  forceRefresh() {
    this.cache = { dashboard: null, deptFlows: null, calendar: null };
    this.refreshCurrentPage();
  },

  toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); },

  switchView(viewId, title = '') {
    document.querySelectorAll('.content-view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (title) document.getElementById('page-main-title').innerText = title;
    
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

  refreshCurrentPage() {
    if(document.getElementById('view-dashboard').classList.contains('active')) app.dashboard.loadDashboard();
    else if(document.getElementById('view-dept-flows').classList.contains('active')) app.department.loadDeptFlows(app.currentDept);
    else if(document.getElementById('view-calendar').classList.contains('active')) app.calendar.loadCalendar();
  }
};
window.onload = () => app.init();
