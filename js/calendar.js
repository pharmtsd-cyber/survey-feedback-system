app.calendar = {
  instance: null, cachedData: null,

  async loadCalendar(menuItem = null) {
    if(menuItem) app.setActiveMenu(menuItem);
    app.switchView('view-calendar', '行事曆總覽');
    
    let calendarEl = document.getElementById('calendar-container');
    if (!this.instance) {
      this.instance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth', locale: 'zh-tw', height: 'auto',
        events: async (info, successCallback, failureCallback) => {
          try {
            const startDate = info.startStr.substring(0, 10); const endDate = info.endStr.substring(0, 10);
            const cacheKey = `${startDate}_${endDate}_all`;
            
            let data;
            if (app.cache.calendar[cacheKey]) data = app.cache.calendar[cacheKey];
            else { data = await app.api({ action: 'getCalendar', startDate, endDate, department: '' }); app.cache.calendar[cacheKey] = data; }
            this.cachedData = data;
            
            let deptSet = new Set(), wfSet = new Set();
            for(let date in data.days) data.days[date].details.forEach(d => { deptSet.add(d.dept); wfSet.add(d.wfName); });
            data.periodicTasks.forEach(d => { deptSet.add(d.dept); wfSet.add(d.wfName); });
            
            this.updateDropdown('cal-filter-dept', '所有單位', deptSet);
            this.updateDropdown('cal-filter-wf', '所有任務', wfSet);

            this.renderPeriodicBoard(); // ✅ 渲染上方週期看板

            let filterDept = document.getElementById('cal-filter-dept').value;
            let filterWf = document.getElementById('cal-filter-wf').value;
            
            let events = [];
            for(let dateStr in data.days) {
              let d = data.days[dateStr];
              let filteredDetails = d.details.filter(item => (filterDept === '' || item.dept === filterDept) && (filterWf === '' || item.wfName === filterWf));
              if (filteredDetails.length > 0) {
                let comp = filteredDetails.filter(x => x.status.includes('已填寫')).length;
                let incomp = filteredDetails.filter(x => x.status === '未填寫').length;
                events.push({ start: dateStr, title: `完成: ${comp} | 未填寫: ${incomp}`, color: incomp > 0 ? '#dc3545' : '#198754', extendedProps: { details: filteredDetails } });
              }
            }
            successCallback(events);
          } catch(e) { failureCallback(e); }
        },
        eventClick: (info) => { this.renderDetails(info.event.startStr.substring(0, 10), info.event.extendedProps.details); }
      });
      this.instance.render();
    } else {
      this.instance.refetchEvents();
    }
    document.getElementById('calendar-details-container').innerHTML = '<div class="text-muted mt-3">請點選上方行事曆有標記的日期，即可於此查看明細。</div>';
  },

  updateDropdown(elId, defaultText, optionsSet) {
    let el = document.getElementById(elId); let currVal = el.value;
    el.innerHTML = `<option value="">${defaultText}</option>` + Array.from(optionsSet).map(opt => `<option value="${opt}">${opt}</option>`).join('');
    el.value = currVal;
  },

  applyFilters() {
    if(this.instance) this.instance.refetchEvents();
    document.getElementById('calendar-details-container').innerHTML = '<div class="text-muted mt-3">資料已篩選，請重新點選上方日期查看明細。</div>';
  },

  // ✅ 渲染上方不佔格子的「週期性任務進度」
  renderPeriodicBoard() {
    let filterDept = document.getElementById('cal-filter-dept').value;
    let filterWf = document.getElementById('cal-filter-wf').value;
    
    let pTasks = this.cachedData.periodicTasks.filter(item => (filterDept === '' || item.dept === filterDept) && (filterWf === '' || item.wfName === filterWf));
    
    let board = document.getElementById('cal-period-board');
    let listEl = document.getElementById('cal-period-list');
    if (pTasks.length === 0) { board.style.display = 'none'; return; }
    
    board.style.display = 'block';
    listEl.innerHTML = pTasks.map(t => {
      let badge = t.status === '未填寫' ? 'bg-secondary' : (t.status.includes('異常') ? 'bg-danger' : 'bg-success');
      return `<div class="list-group-item d-flex justify-content-between align-items-center py-3">
                <div><div class="fw-bold fs-6">${t.wfName} <span class="badge bg-light text-dark border ms-2">${t.dept}</span></div><small class="text-muted">${t.periodLabel}</small></div>
                <span class="badge ${badge} fs-6 shadow-sm">${t.status}</span>
              </div>`;
    }).join('');
  },

  renderDetails(dateStr, details) {
    let html = `<h5 class="fw-bold mb-3 mt-4 border-bottom pb-2"><i class="bi bi-card-list"></i> ${dateStr} 任務狀態明細</h5>`;
    let grouped = {};
    details.forEach(d => { if(!grouped[d.dept]) grouped[d.dept] = []; grouped[d.dept].push(d); });

    for(let dept in grouped) {
      html += `<h6 class="fw-bold text-primary mt-3"><i class="bi bi-building"></i> ${dept}</h6><div class="mb-3">`;
      grouped[dept].forEach(d => {
        let badgeClass = ''; let jumpBtn = '';
        if (d.status === '未填寫') {
          badgeClass = 'bg-secondary';
          jumpBtn = `<button class="btn btn-sm btn-primary fw-bold ms-2 shadow-sm" onclick="app.department.startWorkflowFromCalendar('${d.wfId}', '${dept}', '${dateStr}')">啟動任務</button>`;
        } else badgeClass = d.status.includes('異常') ? 'bg-danger' : 'bg-success';

        html += `<div class="card shadow-sm border-0 mb-3 bg-white"><div class="card-body p-3"><div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom"><div><div class="fw-bold fs-5 text-dark">${d.wfName} <span class="badge bg-light text-dark border ms-2 fs-6">${d.category}</span></div></div><div class="d-flex align-items-center"><span class="badge ${badgeClass} fs-6 shadow-sm">${d.status}</span>${jumpBtn}</div></div>`;
        if (d.flows && d.flows.length > 0) {
          html += `<div class="bg-light p-2 rounded border-0">`;
          d.flows.forEach(f => {
             let fBadge = f.status === '維修中' ? 'bg-warning text-dark' : (f.status === '異常' ? 'bg-danger' : (f.status === '正常' ? 'bg-success' : 'bg-secondary'));
             let actionBtn = f.recordId ? `<button class="btn btn-sm btn-outline-primary ms-2 bg-white" onclick="app.department.openForm('edit', '${f.flowId}', '${f.flowName}', '${f.recordId}')">查看</button>` : '';
             html += `<div class="d-flex justify-content-between align-items-center py-2 border-bottom border-white"><div class="ms-1 ps-2 border-start border-3 border-secondary"><span class="fw-bold d-block text-dark">${f.flowName}</span><small class="text-muted">${f.empName ? `<i class="bi bi-person text-primary"></i> ${f.empName} ｜ ` : ''}<i class="bi bi-clock"></i> ${f.time || '尚未填寫'}</small></div><div><span class="badge ${fBadge}">${f.status}</span>${actionBtn}</div></div>`;
          });
          html += `</div>`;
        }
        html += `</div></div>`;
      });
      html += '</div>';
    }
    document.getElementById('calendar-details-container').innerHTML = html;
  }
};
