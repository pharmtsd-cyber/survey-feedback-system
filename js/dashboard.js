app.dashboard = {
  charts: {},

  async loadDashboard(menuItem = null) {
    if(menuItem) app.setActiveMenu(menuItem);
    app.switchView('view-dashboard', '系統總覽');
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    const data = await app.api({ action: 'getDashboard', startDate, endDate, department: app.user.dept });
    document.getElementById('dash-exc-count').innerText = data.exceptionCount;
    
    // 異常手風琴卡片
    let excHtml = '';
    if(data.exceptionsList.length > 0) {
      data.exceptionsList.forEach((e, i) => {
        let colId = `exc-col-${i}`;
        excHtml += `
          <div class="accordion-item bg-transparent border-bottom border-light">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed bg-transparent text-white p-2 d-flex flex-wrap gap-2" type="button" data-bs-toggle="collapse" data-bs-target="#${colId}">
                <strong class="fs-6 mb-0">${e.flowName}</strong>
                <div class="ms-auto d-flex gap-1">
                  <span class="badge bg-light text-danger shadow-sm">${e.flowDept}</span>
                  <span class="badge bg-light text-primary shadow-sm">${e.flowCategory}</span>
                </div>
              </button>
            </h2>
            <div id="${colId}" class="accordion-collapse collapse" data-bs-parent="#acc-exceptions">
              <div class="accordion-body p-2 pt-0 text-white-50 small">
                <div class="mt-2"><i class="bi bi-person"></i> ${e.empName} ｜ <i class="bi bi-clock"></i> ${e.time}</div>
                <div class="mt-2 bg-white text-danger px-2 py-1 rounded fw-bold shadow-sm d-inline-block">${e.qTitle} : ${e.value}</div>
                <div class="mt-2 text-end">
                  <button class="btn btn-sm btn-light text-primary fw-bold shadow-sm" onclick="app.department.openForm('edit', '${e.flowId}', '${e.flowName}', '${e.recordId}')">前往回覆/修改 <i class="bi bi-arrow-right"></i></button>
                </div>
              </div>
            </div>
          </div>`;
      });
    } else {
      excHtml = '<div class="p-2 text-white">目前區間無異常。</div>';
    }
    document.getElementById('acc-exceptions').innerHTML = excHtml;
      
    // 未完成清單 (顯示單位與分類)
    document.getElementById('dash-inc-list').innerHTML = data.incompleteFlows.length > 0
      ? data.incompleteFlows.map(f => `
        <li class="mb-2 fs-6 px-2 d-flex flex-wrap align-items-center gap-1">
          <i class="bi bi-x-circle text-danger me-1"></i>
          <span class="badge bg-light text-dark border">${f.dept}</span>
          <span class="badge bg-info text-dark border">${f.category}</span>
          <span class="fw-bold ms-1 text-break">${f.name}</span>
        </li>`).join('')
      : '<li class="px-2"><i class="bi bi-check-circle text-success fs-5 me-2"></i> 區間內全數完成！</li>';

    this.loadDashboardCharts(startDate, endDate);
  },

  async loadDashboardCharts(startDate, endDate) {
    const data = await app.api({ action: 'getTempHistoryByDate', startDate, endDate, department: app.user.dept });
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
  }
};
