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
          <button class="btn btn-sm btn-primary fw-bold text-nowrap shadow-sm" onclick="app.department.startWorkflow('${wf.id}')">啟動任務</button>
        </li>`).join('')
      : '<li class="p-2 text-success fw-bold"><i class="bi bi-check-circle fs-5 me-2"></i> 本日指定任務全數填寫完畢！</li>';

    let html = '';
    let sortedCategories = Object.keys(res.categories).sort();
    sortedCategories.forEach(catName => {
      html += `<h5 class="fw-bold text-primary mt-4 mb-3 border-bottom pb-2"><i class="bi bi-tags"></i> ${catName}</h5>`;
      let wfs = res.categories[catName];
      wfs.forEach(wf => {
        let collapseId = `col-${wf.id}`;
        // ✅ 修正：未完成改為未填寫
        let wfStatusBadge = wf.isComplete ? `<span class="badge bg-success rounded-pill px-3 fs-6 shadow-sm"><i class="bi bi-check"></i> 任務完成</span>` : `<span class="badge bg-secondary rounded-pill px-3 fs-6 shadow-sm">未填寫</span>`;

        let listHtml = '';
        wf.flows.forEach(f => {
          if(f.records.length > 0) {
            f.records.forEach(r => {
               // ✅ 狀態標籤判斷加入「維修中」
               let badge = `<span class="badge bg-success shadow-sm">正常</span>`;
               if(r.formStatus === '維修中') badge = `<span class="badge bg-warning text-dark shadow-sm">維修中</span>`;
               else if(r.isException) badge = `<span class="badge bg-danger shadow-sm">異常</span>`;
               
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
                    <button class="btn btn-sm btn-primary fw-bold shadow-sm px-3" onclick="app.department.startWorkflow('${wf.id}')"><i class="bi bi-play-circle"></i> 進入任務</button>
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

  async startWorkflowFromCalendar(wfId, dept, dateStr) {
    document.getElementById('target-date').value = dateStr;
    await this.loadDeptFlows(dept);
    this.startWorkflow(wfId);
  },

  startWorkflow(wfId) {
    const targetDate = document.getElementById('target-date').value;
    const cacheKey = `${app.currentDept}_${targetDate}`;
    const res = app.cache.deptFlows[cacheKey];
    if(!res) return alert("資料尚未載入！");
    
    let targetWf = null;
    for (let cat in res.categories) {
        let found = res.categories[cat].find(w => w.id === wfId);
        if (found) targetWf = found;
    }
    if (!targetWf) return alert("找不到任務流資料！");

    let startIndex = 0;
    for (let i = 0; i < targetWf.flows.length; i++) {
        if (targetWf.flows[i].records && targetWf.flows[i].records.length > 0) {
            startIndex = i + 1; 
        } else {
            break;
        }
    }

    if (startIndex >= targetWf.flows.length) {
        if(confirm("此任務流本日已全數填寫完畢！是否要查看/修改最後一個表單？")) {
            startIndex = targetWf.flows.length - 1;
        } else {
            return;
        }
    }

    app.currentWorkflow = { 
        id: targetWf.id, 
        name: targetWf.name, 
        flows: JSON.parse(JSON.stringify(targetWf.flows)),
        currentIndex: startIndex 
    };

    this.openWorkflowStep();
  },

  openWorkflowStep() {
    let wf = app.currentWorkflow;
    let stepFlow = wf.flows[wf.currentIndex];
    let isEdit = stepFlow.records && stepFlow.records.length > 0;
    let recId = isEdit ? stepFlow.records[0].recordId : null;
    
    this.openForm(isEdit ? 'edit' : 'new', stepFlow.id, stepFlow.name, recId, true);
  },

  prevWorkflowStep() {
    if (app.currentWorkflow && app.currentWorkflow.currentIndex > 0) {
        app.currentWorkflow.currentIndex--;
        this.openWorkflowStep();
    }
  },

  toggleFormStatus(status) {
    const qc = document.getElementById('questions-container');
    if (status === '維修中') {
        qc.style.display = 'none';
    } else {
        qc.style.display = 'block';
    }
  },

  async openForm(mode, flowId, flowName, recordId = null, isWorkflow = false) {
    if(!isWorkflow) app.currentWorkflow = null;
    app.formMode = mode;
    app.currentFlow = { id: flowId, name: flowName, recordId: recordId };
    
    app.switchView('view-form', `${app.currentWorkflow ? app.currentWorkflow.name + ' - ' : ''}資料讀取中...`);
    
    let res;
    if (app.cache.questions[flowId]) {
        res = app.cache.questions[flowId];
    } else {
        res = await app.api({ action: 'getQuestions', flowId: flowId });
        app.cache.questions[flowId] = res;
    }
    
    app.questions = res.questions;
    app.currentFlow.name = res.flowName;
    let defaultFormStatus = res.flowStatus === '維修中' ? '維修中' : '正常';

    let progressText = '';
    if(app.currentWorkflow) progressText = ` <span class="badge bg-info text-dark fs-6 ms-2 shadow-sm border border-light">步驟 ${app.currentWorkflow.currentIndex + 1} / ${app.currentWorkflow.flows.length}</span>`;
    document.getElementById('page-main-title').innerHTML = `${app.currentWorkflow ? app.currentWorkflow.name + ' - ' : ''}${res.flowName} ${mode === 'edit' ? '(修改)' : ''} ${progressText}`;
    
    let oldAnswers = {};
    let currentFormStatus = defaultFormStatus;
    
    if(mode === 'edit') {
       const recData = await app.api({ action: 'getRecord', recordId: recordId });
       oldAnswers = recData.answers || {};
       if(recData.formStatus) currentFormStatus = recData.formStatus === '維修中' ? '維修中' : '正常';
    }

    const container = document.getElementById('form-container');
    container.innerHTML = `
      <div class="card mb-4 border-0 shadow-sm border-start border-warning border-4">
        <div class="card-body">
          <h5 class="fw-bold mb-2 text-dark"><i class="bi bi-gear-fill text-warning"></i> 表單 (設備) 狀態</h5>
          <select id="form-status-toggle" class="form-select form-select-lg fw-bold" onchange="app.department.toggleFormStatus(this.value)">
            <option value="正常" ${currentFormStatus === '正常' ? 'selected' : ''}>🟢 設備正常 (須填表)</option>
            <option value="維修中" ${currentFormStatus === '維修中' ? 'selected' : ''}>🔧 維修中 (免填表直接儲存)</option>
          </select>
        </div>
      </div>
      <div id="questions-container"></div>
    `;
    
    const qContainer = document.getElementById('questions-container');
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
      qContainer.innerHTML += html;
    });

    this.toggleFormStatus(currentFormStatus);

    let btnHtml = '';
    if (isWorkflow && app.currentWorkflow.currentIndex > 0) {
        btnHtml += `<button class="btn btn-outline-secondary flex-fill fw-bold shadow-sm py-2" onclick="app.department.prevWorkflowStep()"><i class="bi bi-arrow-left"></i> 上一頁</button>`;
    } else {
        btnHtml += `<button class="btn btn-secondary flex-fill fw-bold shadow-sm py-2" onclick="app.department.goBack()"><i class="bi bi-box-arrow-left"></i> 返回清單</button>`;
    }
    
    if (mode === 'edit') {
        btnHtml += `<button class="btn btn-danger flex-fill fw-bold shadow-sm py-2" onclick="app.department.deleteRecord()"><i class="bi bi-trash"></i> 刪除</button>`;
    }
    
    let submitText = (isWorkflow && app.currentWorkflow.currentIndex < app.currentWorkflow.flows.length - 1) ? "儲存並下一步 <i class='bi bi-arrow-right'></i>" : "<i class='bi bi-check-lg'></i> 確認儲存";
    btnHtml += `<button class="btn btn-primary flex-fill fw-bold shadow-sm py-2" onclick="app.department.submitForm()">${submitText}</button>`;
    document.getElementById('form-actions').innerHTML = btnHtml;
  },

  goBack() { 
    if(app.currentDept) this.loadDeptFlows(app.currentDept);
    else app.dashboard.loadDashboard();
  },

  async deleteRecord() {
    if(!confirm("確定要刪除這筆紀錄嗎？刪除後無法還原。")) return;
    await app.api({ action: 'deleteRecord', recordId: app.currentFlow.recordId });
    app.cache.dashboard = {}; app.cache.deptFlows = {}; app.cache.calendar = {};
    alert("紀錄已刪除！");
    
    if(app.currentWorkflow) {
        app.currentWorkflow.flows[app.currentWorkflow.currentIndex].records = [];
        this.openWorkflowStep();
    } else {
        this.goBack();
    }
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader(); r.readAsDataURL(file);
      r.onload = () => resolve(r.result); r.onerror = e => reject(e);
    });
  },

  async submitForm() {
    let formStatus = document.getElementById('form-status-toggle').value;
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
      
      if (formStatus === '維修中') {
         value = ""; isException = false;
      } else {
         if (q.isRequired && value === "") return alert(`請填寫必填項目：${q.title}`);
      }
      answers.push({ qId: q.qId, value: value, isException: isException });
    }

    const payload = { 
       action: 'submitForm', empId: app.user.empId, flowId: app.currentFlow.id, 
       answers: answers, recordId: app.formMode === 'edit' ? app.currentFlow.recordId : null,
       formStatus: formStatus
    };
    
    const res = await app.api(payload);
    app.cache.dashboard = {}; app.cache.deptFlows = {}; app.cache.calendar = {};

    if (app.currentWorkflow) {
        app.currentWorkflow.flows[app.currentWorkflow.currentIndex].records = [{ recordId: res.recordId }];
        if (res.exceptionTriggered && formStatus !== '維修中') alert("本步驟儲存成功！注意：有異常數值，已通報處理。");
        
        app.currentWorkflow.currentIndex++;
        if (app.currentWorkflow.currentIndex < app.currentWorkflow.flows.length) {
            this.openWorkflowStep(); 
        } else {
            alert("✅ 任務流全數填寫完畢！");
            this.goBack();
        }
    } else {
        if (res.exceptionTriggered && formStatus !== '維修中') alert("儲存成功！注意：有異常數值，已通報處理。");
        else alert("儲存成功！");
        this.goBack();
    }
  }
};
