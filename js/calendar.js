app.calendar = {
  instance: null,

  async loadCalendar(menuItem = null) {
    if(menuItem) app.setActiveMenu(menuItem);
    app.switchView('view-calendar', '行事曆總覽');
    
    let calendarEl = document.getElementById('calendar-container');
    if (!this.instance) {
      this.instance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth', locale: 'zh-tw', height: 'auto',
        events: async (info, successCallback, failureCallback) => {
          try {
            const startDate = info.startStr.substring(0, 10); 
            const endDate = info.endStr.substring(0, 10);
            const cacheKey = `${startDate}_${endDate}_${app.user.dept}`;
            
            let data;
            if (app.cache.calendar && app.cache.calendar.key === cacheKey) {
                data = app.cache.calendar.data;
            } else {
                data = await app.api({ action: 'getCalendar', startDate, endDate, department: app.user.dept });
                app.cache.calendar = { key: cacheKey, data };
            }
            
            let events = [];
            for(let dateStr in data) {
              let d = data[dateStr];
              events.push({
                start: dateStr,
                title: `完成: ${d.completedCount} | 未完: ${d.incompleteCount}`,
                color: d.incompleteCount > 0 ? '#dc3545' : '#198754',
                extendedProps: { details: d.details }
              });
            }
            successCallback(events);
          } catch(e) { failureCallback(e); }
        },
        eventClick: (info) => {
          this.renderDetails(info.event.startStr, info.event.extendedProps.details);
        }
      });
      this.instance.render();
    } else {
      this.instance.refetchEvents();
    }
    document.getElementById('calendar-details-container').innerHTML = '<div class="text-muted mt-3">請點選上方行事曆有標記的日期，即可於此查看明細。</div>';
  },

  renderDetails(dateStr, details) {
    let html = `<h5 class="fw-bold mb-3 mt-4 border-bottom pb-2"><i class="bi bi-card-list"></i> ${dateStr} 紀錄明細</h5>`;
    let grouped = {};
    details.forEach(d => {
      if(!grouped[d.dept]) grouped[d.dept] = [];
      grouped[d.dept].push(d);
    });

    for(let dept in grouped) {
      html += `<h6 class="fw-bold text-primary mt-3"><i class="bi bi-building"></i> ${dept}</h6><div class="list-group shadow-sm mb-3">`;
      grouped[dept].forEach(d => {
        let badgeClass = d.status.includes('異常') || d.status === '未完成' ? 'bg-danger' : 'bg-success';
        let jumpBtn = d.recordId ? `<button class="btn btn-sm btn-outline-${badgeClass.split('-')[1]} fw-bold ms-2 shadow-sm" onclick="app.department.openForm('edit', '${d.flowId}', '${d.flowName}', '${d.recordId}')">查看紀錄</button>` : '';
        html += `
          <div class="list-group-item d-flex justify-content-between align-items-center">
            <div>
              <div class="fw-bold fs-5">${d.flowName} <span class="badge bg-light text-dark border ms-2 fs-6">${d.category}</span></div>
              <div class="text-muted small mt-1">
                ${d.empName ? `<i class="bi bi-person"></i> ${d.empName} ｜ ` : ''} ${d.time ? `<i class="bi bi-clock"></i> ${d.time}` : '尚未填寫'}
              </div>
            </div>
            <div class="d-flex align-items-center"><span class="badge ${badgeClass} fs-6">${d.status}</span>${jumpBtn}</div>
          </div>`;
      });
      html += '</div>';
    }
    document.getElementById('calendar-details-container').innerHTML = html;
  }
};
