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
            const cacheKey = `${startDate}_${endDate}_all`;
            
            let data;
            if (app.cache.calendar[cacheKey]) {
                data = app.cache.calendar[cacheKey];
            } else {
                data = await app.api({ action: 'getCalendar', startDate, endDate, department: '' });
                app.cache.calendar[cacheKey] = data;
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
          this.renderDetails(info.event.startStr.substring(0, 10), info.event.extendedProps.details);
        }
      });
      this.instance.render();
    } else {
      this.instance.refetchEvents();
    }
    document.getElementById('calendar-details-container').innerHTML = '<div class="text-muted mt-3">請點選上方行事曆有標記的日期，即可於此查看明細。</div>';
  },

  renderDetails(dateStr, details) {
    let html = `<h5 class="fw-bold mb-3 mt-4 border-bottom pb-2"><i class="bi bi-card-list"></i> ${dateStr} 任務狀態明細</h5>`;
    let grouped = {};
    details.forEach(d => {
      if(!grouped[d.dept]) grouped[d.dept] = [];
      grouped[d.dept].push(d);
    });

    for(let dept in grouped) {
      html += `<h6 class="fw-bold text-primary mt-3"><i class="bi bi-building"></i> ${dept}</h6><div class="list-group shadow-sm mb-3 border-0">`;
      grouped[dept].forEach(d => {
        let badgeClass = ''; let jumpBtn = '';
        
        if (d.status === '未完成') {
          badgeClass = 'bg-secondary';
          jumpBtn = `<button class="btn btn-sm btn-primary fw-bold ms-2 shadow-sm" onclick="app.department.startWorkflow('${d.wfId}', '${d.wfName}', '${d.flowIds}')">啟動任務</button>`;
        } else {
          badgeClass = d.status.includes('異常') ? 'bg-danger' : 'bg-success';
        }

        html += `
          <div class="list-group-item d-flex justify-content-between align-items-center py-3">
            <div>
              <div class="fw-bold fs-5 text-dark">${d.wfName} <span class="badge bg-light text-dark border ms-2 fs-6">${d.category}</span></div>
            </div>
            <div class="d-flex align-items-center"><span class="badge ${badgeClass} fs-6 shadow-sm">${d.status}</span>${jumpBtn}</div>
          </div>`;
      });
      html += '</div>';
    }
    document.getElementById('calendar-details-container').innerHTML = html;
  }
};
