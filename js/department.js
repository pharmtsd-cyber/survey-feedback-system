app.department = {
  async loadDeptFlows(dept, menuItem = null) {
    if(menuItem) app.setActiveMenu(menuItem);
    app.currentDept = dept;
    app.switchView('view-dept-flows', `${dept} 任務清單`);
    
    const targetDate = document.getElementById('target-date').value;
    const cacheKey = `${dept}_${targetDate}`;
    let res;
    if (app.cache.deptFlows[cacheKey]) {
        res = app.cache.deptFlows[cacheKey];
    } else {
        res = await app.api({ action: 'getDeptFlows', department: dept, targetDate: targetDate });
        app.cache.deptFlows[cacheKey] = res;
    }
    
    let groupedExcs = {};
    res.exceptionsList.forEach(e => {
        if(!groupedExcs[e.recordId]) groupedExcs[e.recordId] = { ...e, anomalies: [] };
        groupedExcs[e.recordId].anomalies.push(`${e.qTitle}: ${e.value}`);
    });
    const uniqueExcs = Object.values(groupedExcs);
    
    document.getElementById('dept-exc-count').innerText = res.exceptionCount;
    document.getElementById('dept-exc-list').innerHTML = uniqueExcs.length > 0 
      ? uniqueExcs.map(e => `
          <li class="mb-2 p-2 bg-white rounded shadow-sm border-start border-danger border-4 d-flex justify-content-between align-items-center text-dark">
            <div>
              <span class="badge bg-light text-dark border me-1">${e.flowDept}</span><span class="badge bg-info text-dark border me-1">${e.wfName || e.flowCategory}</span><strong class="fs-6">${e.flowName}</strong>
              <div class="text-muted small mt-1"><i class="bi bi-person"></i> ${e.empName} | <i class="bi bi-clock"></i> ${e.time}</div>
              <div class="text-danger small mt-1 fw-bold">${e.anomalies.join(' , ')}</div>
            </div>
            <button class="btn btn-sm btn-outline-danger fw-bold text-nowrap ms-2 shadow-sm" onclick="app.department.openForm('edit', '${e.flowId}', '${e.flowName}', '${e.recordId}')">處理異常</button>
          </li>`).join('')
      : '<li class="p-2 text-white fw-bold"><i class="bi bi-check-circle fs-5 me-2"></i> 目前無異常！</li>';

    document.getElementById('dept-inc-list').innerHTML = res.incompleteList.length > 0
      ? res.incompleteList.map(wf => `
        <li class="mb-2 p-2 bg-white rounded shadow-sm d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 border-start border-warning border-4">
          <div class="d-flex flex-wrap align-items-center gap-1">
            <i class="bi bi-x-circle text-danger me-1"></i>
            <span class="badge bg-light text-dark border">${wf.dept}</span><span class="badge bg-info text-dark border">${wf.category}</span>
            <span class="fw-bold ms-1 text-break">${wf.name}</span>
          </div>
          <button class="btn btn-sm btn-primary fw-bold text-nowrap shadow-sm" onclick="app.department.startWorkflow('${wf.id}', '${wf.name}', '${wf.flowIds}')">啟動任務</button>
        </li>`).join('')
      : '<li class="p-2 text-success fw-bold"><i class="bi bi-check-circle fs-5 me-2"></i> 本日指定任務全數完成！</li>';

    let html = '';
    let sortedCategories = Object.keys(res.categories).sort();
    sortedCategories.forEach(catName => {
      html += `<h5 class="fw-bold text-primary mt-4 mb-3 border-bottom pb-2"><i class="bi bi-tags"></i> ${catName}</h5>`;
      let wfs = res.categories[catName];
      wfs.forEach(wf => {
        let collapseId = `col-${wf.id}`;
        let wfStatusBadge = wf.isComplete ? `<span class="badge bg-success rounded-pill px-3 fs-6 shadow-sm"><i class="bi bi-check"></i> 任務完成</span>` : `<span class="badge bg-secondary rounded-pill px-3 fs-6 shadow-sm">未完成</span>`;

        let listHtml = '';
        wf.flows.forEach(f => {
          if(f.records.length > 0) {
            f.records.forEach(r => {
               let badge = r.isException ? `<span class="badge bg-danger shadow-sm">異常</span>` : `<span class="badge bg-success shadow-sm">正常</span>`;
               listHtml += `
                 <div class="list-group-item d-flex justify-content-between align-items-center py-2 bg-light">
                   <div class="ms-1 border-start border-3 border-primary ps-2">
                     <span class="fw-bold text-dark d-block">${f.name}</span>
                     <small class="text-muted"><i class="bi bi-person"></i> ${r.empName} | <i class="bi bi-clock"></i> ${r.time}</small>
                   </div>
                   <div>${badge} <button class="btn btn-sm btn-outline-primary ms-2 bg-white" onclick="app.department.openForm('edit', '${f.id}', '${f.name}', '${r.recordId}')">查看紀錄</button></div>
                 </div>`;
            });
          } else {
             listHtml += `
               <div class="list-group-item d-flex justify-content-between align-items-center py-3 bg-white">
                 <div class="ms-1 text-muted ps-2"><span class="fw-bold d-block">${f.name}</span> <small>尚未填寫</small></div>
               </div>`;
          }
        });

        html += `
          <div class="accordion mb-3 shadow-sm rounded border-0" id="acc-${wf.id}">
            <div class="accordion-item border-0">
              <h2 class="accordion-header">
                <button class="accordion-button collapsed bg-white text-dark rounded py-3" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                  <strong class="fs-5">${wf.name}</strong>
                  <span class="ms-auto me-2">${wfStatusBadge}</span>
                </button>
              </h2>
              <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#acc-${wf.id}">
                <div class="accordion-body p-0">
                  <div class="p-2 bg-light text-end border-bottom border-top">
                    <button class="btn btn-sm btn-primary fw-bold shadow-sm px-3" onclick="app.department.startWorkflow('${wf.id}', '${wf.name}', '${wf.flowIds}')"><i class="bi bi-play-circle"></i> 進入任務</button>
                  </div>
                  <div class="list-group list-group-flush">${listHtml}</div>
                </div>
              </div>
            </div>
          </div>`;
      });
    });
    document.getElementById('dept-accordion-container').innerHTML = html || '<p class="text-muted mt-3">此單位尚未設定任務流。</p>';
  },

  startWorkflow(wfId, wfName, flowIdsStr) {
    let ids = flowIdsStr.split(',').map(s=>s.trim()).filter(s=>s!=='');
    if(ids.length === 0) return alert("此任務流尚未綁定任何表單！");
    app.currentWorkflow = { id: wfId, name: wfName, flows: ids, currentIndex: 0 };
    this.openForm('new', ids[0], '讀取中...', null, true);
  },

  async openForm(mode, flowId, flowName, recordId = null, isWorkflow = false) {
    if(!isWorkflow) app.currentWorkflow = null;
    app.formMode = mode;
    app.currentFlow = { id: flowId, name: flowName, recordId: recordId };
    
    // 預先切換畫面顯示讀取中
    app.switchView('view-form', `${app.currentWorkflow ? app.currentWorkflow.name + ' - ' : ''}資料讀取中...`);
    document.getElementById('btn-delete-form').style.display = mode === 'edit' ? 'block' : 'none';
    
    const res = await app.api({ action: 'getQuestions', flowId: flowId });
    app.questions = res.questions;
    app.currentFlow.name = res.flowName;

    // 更新正式標題與進度
    let progressText = '';
    if(app.currentWorkflow) progressText = ` <span class="badge bg-info text-dark fs-6 ms-2 shadow-sm border border-light">步驟 ${app.currentWorkflow.currentIndex + 1} / ${app.currentWorkflow.flows.length}</span>`;
    document.getElementById('page-main-title').innerHTML = `${app.currentWorkflow ? app.currentWorkflow.name + ' - ' : ''}${res.flowName} ${mode === 'edit' ? '(修改)' : ''} ${progressText}`;
    
    let oldAnswers = {};
    if(mode === 'edit') oldAnswers = await app.api({ action: 'getRecord', recordId: recordId });

    const container = document.getElementById('form-container');
    container.innerHTML = '';
    
    app.questions.forEach(q => {
      const ansData = oldAnswers[q.qId] || { value: '', isException: false };
      const val = ansData.value;
      const isExc = ansData.isException;
      
      const reqMark = q.isRequired ? `<span class="text-danger ms-1">*</span>` : '';
      const excBadge = isExc ? `<span class="badge bg-danger ms-2"><i class="bi bi-exclamation-triangle"></i> 異常狀態</span>` : '';
      const borderClass = isExc ? 'border border-danger border-3 shadow' : 'border-0 shadow-sm';

      let html = `<div class="card mb-4 ${borderClass}"><div class="card-body"><h5 class="fw-bold mb-3 text-dark">${q.title} ${reqMark} ${excBadge}</h5>`;
      
      if(q.type === '單選') {
        q.options.forEach(opt => {
          const checked = val === opt ? 'checked' : '';
          html += `<div class="form-check mb-2"><input type="radio" name="${q.qId}" value="${opt}" class="form-check-input" ${checked}> <label class="form-check-label fs-5">${opt}</label></div>`;
        });
      } else if (q.type === '多選') {
        let valArr = val.split(',');
        q.options.forEach(opt => {
          const checked = valArr.includes(opt) ? 'checked' : '';
          html += `<div class="form-check mb-2"><input type="checkbox" name="${q.qId}" value="${opt}" class="form-check-input" ${checked}> <label class="form-check-label fs-5">${opt}</label></div>`;
        });
      } else if (q.type === '數字' || q.type === '溫度') {
        html += `<input type="number" step="any" id="${q.qId}" class="form-control form-control-lg bg-light border border-secondary shadow-sm" value="${val}">`;
      } else if (q.type === '照片') {
        if(mode === 'edit' && val.startsWith('http')) {
          html += `<div class="mb-2"><img src="${val}" class="img-fluid rounded shadow-sm" style="max-height:200px;"></div><small class="text-muted d-block mb-2">上傳新照將覆蓋</small>`;
        }
        html += `<input type="file" accept="image/*" class="form-control form-control-lg border-secondary shadow-sm" id="${q.qId}">`;
      }
      html += `</div></div>`;
      container.innerHTML += html;
    });
  },

  goBack() { 
    if(app.currentDept) this.loadDeptFlows(app.currentDept);
    else app.dashboard.loadDashboard();
  },

  async deleteRecord() {
    if(!confirm("確定要刪除這筆紀錄嗎？刪除後無法還原。")) return;
    await app.api({ action: 'deleteRecord', recordId: app.currentFlow.recordId });
    app.cache = { dashboard: {}, deptFlows: {}, calendar: {} };
    alert("紀錄已刪除！");
    this.goBack();
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader(); r.readAsDataURL(file);
      r.onload = () => resolve(r.result); r.onerror = e => reject(e);
    });
  },

  async submitForm() {
    let answers = [];
    for (const q of app.questions) {
      let value = ""; let isException = false;
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
        else if (app.formMode === 'edit') {
          const existingImg = fileInput ? fileInput.parentElement.querySelector('img') : null;
          if (existingImg) value = existingImg.src;
        }
      }
      if (q.isRequired && value === "") return alert(`請填寫必填項目：${q.title}`);
      answers.push({ qId: q.qId, value: value, isException: isException });
    }

    const payload = { action: 'submitForm', empId: app.user.empId, flowId: app.currentFlow.id, answers: answers, recordId: app.formMode === 'edit' ? app.currentFlow.recordId : null };
    const res = await app.api(payload);
    app.cache = { dashboard: {}, deptFlows: {}, calendar: {} }; 

    if (app.currentWorkflow && app.formMode === 'new') {
      if (res.exceptionTriggered) alert("本步驟儲存成功！注意：有異常數值，已通報處理。");
      app.currentWorkflow.currentIndex++;
      if (app.currentWorkflow.currentIndex < app.currentWorkflow.flows.length) {
        let nextFlowId = app.currentWorkflow.flows[app.currentWorkflow.currentIndex];
        this.openForm('new', nextFlowId, '讀取中...', null, true);
      } else {
        alert("✅ 任務流全數完成！");
        this.goBack();
      }
    } else {
      if (res.exceptionTriggered) alert("儲存成功！注意：有異常數值，已通報處理。");
      else alert("儲存成功！");
      this.goBack();
    }
  }
};
