// ... 請在原有的 department.js 中替換 loadDeptFlows 即可：
  async loadDeptFlows(dept, menuItem = null) {
    if(menuItem) app.setActiveMenu(menuItem);
    app.currentDept = dept;
    app.switchView('view-dept-flows', `${dept} 任務清單`);
    
    const targetDate = document.getElementById('target-date').value;
    const cacheKey = `${dept}_${targetDate}`;
    let res;
    if (app.cache.deptFlows[cacheKey]) res = app.cache.deptFlows[cacheKey];
    else { res = await app.api({ action: 'getDeptFlows', department: dept, targetDate: targetDate }); app.cache.deptFlows[cacheKey] = res; }
    
    let groupedExcs = {};
    res.exceptionsList.forEach(e => {
        if(!groupedExcs[e.recordId]) groupedExcs[e.recordId] = { ...e, anomalies: [] };
        groupedExcs[e.recordId].anomalies.push(`${e.qTitle}: ${e.value}`);
    });
    const uniqueExcs = Object.values(groupedExcs);
    
    document.getElementById('dept-exc-count').innerText = res.exceptionCount;
    document.getElementById('dept-exc-list').innerHTML = uniqueExcs.length > 0 ? uniqueExcs.map(e => `<li class="mb-2 p-2 bg-white rounded shadow-sm border-start border-danger border-4 d-flex justify-content-between align-items-center text-dark"><div><span class="badge bg-light text-dark border me-1">${e.flowDept}</span><span class="badge bg-info text-dark border me-1">${e.wfName || e.flowCategory}</span><strong class="fs-6">${e.flowName}</strong><div class="text-muted small mt-1"><i class="bi bi-person"></i> ${e.empName} | <i class="bi bi-clock"></i> ${e.time}</div><div class="text-danger small mt-1 fw-bold">${e.anomalies.join(' , ')}</div></div><button class="btn btn-sm btn-outline-danger fw-bold text-nowrap ms-2 shadow-sm" onclick="app.department.openForm('edit', '${e.flowId}', '${e.flowName}', '${e.recordId}')">處理異常</button></li>`).join('') : '<li class="p-2 text-white fw-bold"><i class="bi bi-check-circle fs-5 me-2"></i> 目前無異常！</li>';

    document.getElementById('dept-inc-list').innerHTML = res.incompleteList.length > 0 ? res.incompleteList.map(wf => `<li class="mb-2 p-2 bg-white rounded shadow-sm d-flex justify-content-between align-items-center border-start border-warning border-4"><div><span class="badge bg-light text-dark border">${wf.dept}</span><span class="badge bg-info text-dark border ms-1">${wf.category}</span><span class="fw-bold ms-1">${wf.name}</span></div><button class="btn btn-sm btn-primary fw-bold text-nowrap shadow-sm ms-2" onclick="app.department.startWorkflow('${wf.id}')">啟動</button></li>`).join('') : '<li class="p-2 text-success fw-bold"><i class="bi bi-check-circle fs-5 me-2"></i> 本日指定任務全數填寫完畢！</li>';

    document.getElementById('dept-period-list').innerHTML = (res.incompletePeriodList && res.incompletePeriodList.length > 0) ? res.incompletePeriodList.map(wf => `<li class="mb-2 p-2 bg-white rounded shadow-sm d-flex justify-content-between align-items-center border-start border-warning border-4"><div><span class="badge bg-light text-dark border">${wf.dept}</span><span class="badge bg-info text-dark border ms-1">${wf.category}</span><span class="fw-bold ms-1">${wf.name}</span></div><button class="btn btn-sm btn-primary fw-bold text-nowrap shadow-sm ms-2" onclick="app.department.startWorkflow('${wf.id}')">啟動</button></li>`).join('') : '<li class="p-2 text-success fw-bold"><i class="bi bi-check-circle fs-5 me-2"></i> 本期無待辦週期任務！</li>';

    let html = '';
    let sortedCategories = Object.keys(res.categories).sort();
    sortedCategories.forEach(catName => {
      html += `<h5 class="fw-bold text-primary mt-4 mb-3 border-bottom pb-2"><i class="bi bi-tags"></i> ${catName}</h5>`;
      let wfs = res.categories[catName];
      wfs.forEach(wf => {
        let collapseId = `col-${wf.id}`;
        let wfStatusBadge = '';
        if(wf.isComplete) wfStatusBadge = `<span class="badge bg-success rounded-pill px-3 fs-6 shadow-sm"><i class="bi bi-check"></i> 任務完成</span>`;
        else if (wf.isRequiredToday || wf.isPeriod) wfStatusBadge = `<span class="badge bg-secondary rounded-pill px-3 fs-6 shadow-sm">未填寫</span>`;
        else wfStatusBadge = `<span class="badge bg-light text-dark border rounded-pill px-3 fs-6 shadow-sm">今日免填</span>`;

        let listHtml = '';
        wf.flows.forEach(f => {
          if(f.records.length > 0) {
            f.records.forEach(r => {
               let badge = `<span class="badge bg-success shadow-sm">正常</span>`;
               if(r.formStatus === '維修中') badge = `<span class="badge bg-warning text-dark shadow-sm">維修中</span>`;
               else if(r.isException) badge = `<span class="badge bg-danger shadow-sm">異常</span>`;
               listHtml += `<div class="list-group-item d-flex justify-content-between align-items-center py-2 bg-light"><div class="ms-1 border-start border-3 border-primary ps-2"><span class="fw-bold text-dark d-block">${f.name}</span><small class="text-muted"><i class="bi bi-person"></i> ${r.empName} | <i class="bi bi-clock"></i> ${r.time}</small></div><div>${badge} <button class="btn btn-sm btn-outline-primary ms-2 bg-white" onclick="app.department.openForm('edit', '${f.id}', '${f.name}', '${r.recordId}')">查看</button></div></div>`;
            });
          } else {
             listHtml += `<div class="list-group-item d-flex justify-content-between align-items-center py-3 bg-white"><div class="ms-1 text-muted ps-2"><span class="fw-bold d-block">${f.name}</span> <small>尚未填寫</small></div></div>`;
          }
        });

        html += `<div class="accordion mb-3 shadow-sm rounded border-0" id="acc-${wf.id}"><div class="accordion-item border-0"><h2 class="accordion-header"><button class="accordion-button collapsed bg-white text-dark rounded py-3" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}"><strong class="fs-5">${wf.name}</strong><span class="ms-auto me-2">${wfStatusBadge}</span></button></h2><div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#acc-${wf.id}"><div class="accordion-body p-0"><div class="p-2 bg-light text-end border-bottom border-top"><button class="btn btn-sm btn-primary fw-bold shadow-sm px-3" onclick="app.department.startWorkflow('${wf.id}')"><i class="bi bi-play-circle"></i> 進入任務</button></div><div class="list-group list-group-flush">${listHtml}</div></div></div></div></div>`;
      });
    });
    document.getElementById('dept-accordion-container').innerHTML = html || '<p class="text-muted mt-3">此單位尚未設定任務流。</p>';
  }
// ...(其餘不變)
