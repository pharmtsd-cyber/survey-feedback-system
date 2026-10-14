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
            const yearMonth = info.startStr.substring(0, 7); 
            const data = await app.api({ action: 'getCalendar', yearMonth: yearMonth, department: app.user.dept });
            
            let events = [];
            for(let dateStr in data) {
              let d = data[dateStr];
              events.push({
                start: dateStr,
                title: `完成: ${d.completedCount} | 未完: ${d.incompleteCount}`,
                color: d.incompleteCount > 0 ? '#dc3545' : '#198754', // 紅色或綠色
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
    document.getElementById('calendar-details-container').innerHTML = '<div class="text-muted mt-3">請點選行事曆上的日期方塊以查看該日明細。</div>';
  },

  renderDetails(dateStr, details) {
    let html = `<h5 class="fw-bold mb-3 mt-4 border-bottom pb-2"><i class="bi bi-card-list"></i> ${dateStr} 紀錄明細</h5><div class="list-group shadow-sm">`;
    details.forEach(d => {
      let badgeClass = d.status.includes('異常') || d.status === '未完成' ? 'bg-danger' : 'bg-success';
      html += `
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-bold fs-5">${d.flowName} <span class="badge bg-light text-dark border ms-2">${d.dept}</span></div>
            <div class="text-muted small mt-1">
              ${d.empName ? `<i class="bi bi-person"></i> ${d.empName} ｜ ` : ''} 
              ${d.time ? `<i class="bi bi-clock"></i> ${d.time}` : '尚未填寫'}
            </div>
          </div>
          <span class="badge ${badgeClass} fs-6">${d.status}</span>
        </div>`;
    });
    html += '</div>';
    document.getElementById('calendar-details-container').innerHTML = html;
  }
};
