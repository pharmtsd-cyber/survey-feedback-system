app.department = {
  async loadDeptFlows(dept, menuItem = null) {
    if(menuItem) app.setActiveMenu(menuItem);
    app.currentDept = dept;
    app.switchView('view-dept-flows', `${dept} 問卷清單`);
    
    const targetDate = document.getElementById('target-date').value;
    const cacheKey = `${dept}_${targetDate}`;
    let res;
    if (app.cache.deptFlows && app.cache.deptFlows.key === cacheKey) {
        res = app.cache.deptFlows.data;
    } else {
        res = await app.api({ action: 'getDeptFlows', department: dept, targetDate: targetDate });
        app.cache.deptFlows = { key: cacheKey, data: res };
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
              <span class="badge bg-light text-dark border me-1">${e.flowDept}</span><span class="badge bg-info text-dark border me-1">${e.flowCategory}</span><strong class="fs-6">${e.flowName}</strong>
              <div class="text-muted small mt-1"><i class="bi bi-person"></i> ${e.empName} | <i class="bi bi-clock"></i> ${e.time}</div>
              <div class="text-danger small mt-1 fw-bold">${e.anomalies.join(' , ')}</div>
            </div>
            <button class="btn btn-sm btn-outline-danger fw-bold text-nowrap ms-2 shadow-sm" onclick="app.department.openForm('edit', '${e.flowId}', '${e.flowName}', '${e.recordId}')">處理異常</button>
          </li>`).join('')
      : '<li class="p-2 text-white fw-bold"><i class="bi bi-check-circle fs-5 me-2"></i> 目前無異常！</li>';

    document.getElementById('dept-inc-list').innerHTML = res.incompleteList.length > 0
      ? res.incompleteList.map(f => `
        <li class="mb-2 p-2 bg-white rounded shadow-sm d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 border-start border-warning border-4">
          <div class="d-flex flex-wrap align-items-center gap-1">
            <i class="bi bi-x-circle text-danger me-1"></i>
            <span class="badge bg-light text-dark border">${f.dept}</span><span class="badge bg-info text-dark border">${f.category}</span>
            <span class="fw-bold ms-1 text-break">${f.name}</span>
          </div>
          <button class="btn btn-sm btn-primary fw-bold text-nowrap shadow-sm" onclick="app.department.openForm('new', '${f.id}', '${f.name}')">前往填寫</button>
        </li>`).join('')
      : '<li class="p-2 text-success fw-bold"><i class="bi bi-check-circle fs-5 me-2"></i> 本日指定任務全數完成！</li>';

    let html = '';
    let sortedCategories = Object.keys(res.categories).sort();
    sortedCategories.forEach(catName => {
      html += `<h5 class="fw-bold text-primary mt-4 mb-3 border-bottom pb-2"><i class="bi bi-tags"></i> ${catName}</h5>`;
      let flows = res.categories[catName];
      flows.forEach((f, index) => {
        let collapseId = `col-${f.id}`;
        if (f.count === 0) {
          html += `
            <div class="card border-0 shadow-sm mb-3"><button class="btn btn-light d-flex justify-content-between align-items-center p-3 text-start" onclick="app.department.openForm('new', '${f.id}', '${f.name}')"><strong class="fs-5">${f.name}</strong><span class="badge bg-secondary rounded-pill px-3 fs-6">未完成</span></button></div>`;
        } else {
          let listHtml = '';
          f.records.forEach(r => {
            let badge = r.isException ? `<span class="badge bg-danger shadow-sm">異常</span>` : `<span class="badge bg-success shadow-sm">正常</span>`;
            listHtml += `
              <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3 cursor-pointer" onclick="app.department.openForm('edit', '${f.id}', '${f.name}', '${r.recordId}')">
                <div><div class="fw-bold"><i class="bi bi-person text-primary"></i> ${r.empName}</div><small class="text-muted"><i class="bi bi-clock"></i> ${r.time}</small></div>
                ${badge}
              </div>`;
          });
          html += `
            <div class="accordion mb-3 shadow-sm rounded" id="acc-${f.id}">
              <div class="accordion-item border-0">
                <h2 class="accordion-header"><button class="accordion-button collapsed bg-white text-dark rounded" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}"><strong class="fs-5">${f.name}</strong><span class="badge bg-success rounded-pill px-3 ms-auto fs-6">完成 ${f.count} 次</span></button></h2>
                <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#acc-${f.id}">
                  <div class="accordion-body p-0">
                    <div class="p-3 bg-light text-end"><button class="btn btn-sm btn-outline-primary fw-bold shadow-sm" onclick="app.department.openForm('new', '${f.id}', '${f.name}')"><i class="bi bi-plus-lg"></i> 新增紀錄</button></div>
                    <div class="list-group list-group-flush">${listHtml}</div>
                  </div>
                </div>
              </div>
            </div>`;
        }
      });
    });
    document.getElementById('dept-accordion-container').innerHTML = html || '<p class="text-muted mt-3">此單位尚未設定問卷。</p>';
  },

  async openForm(mode, flowId, flowName, recordId = null) {
    app.formMode = mode;
    app.currentFlow = { id: flowId, name: flowName, recordId: recordId };
    
    app.switchView('view-form', `${flowName} ${mode === 'edit' ? '(修改紀錄)' : ''}`);
    document.getElementById('btn-delete-form').style.display = mode === 'edit' ? 'block' : 'none';
    
    app.questions = await app.api({ action: 'getQuestions', flowId: flowId });
    let oldAnswers = {};
    if(mode === 'edit') oldAnswers = await app.api({ action: 'getRecord', recordId: recordId });

    const container = document.getElementById('form-container');
    container.innerHTML = '';
    
    app.questions.forEach(q => {
      // ✅ 判斷是否為異常題目，如果異常就加粗紅框
      const ansData = oldAnswers[q.qId] || { value: '', isException: false };
      const val = ansData.value;
      const isExc = ansData.isException;
      
      const reqMark = q.isRequired ? `<span class="text-danger ms-1">*</span>` : '';
      const excBadge = isExc ? `<span class="badge bg-danger ms-2"><i class="bi bi-exclamation-triangle"></i> 異常狀態</span>` : '';
      const borderClass = isExc ? 'border border-danger border-3 shadow' : 'border-0 shadow-sm'; // 🔴 紅框標示

      let html = `<div class="card mb-4 ${borderClass}"><div class="card-body"><h5 class="fw-bold mb-3">${q.title} ${reqMark} ${excBadge}</h5>`;
      
      if(q.type === '單選') {
        q.options.forEach(opt => {
          const checked = val === opt ? 'checked' : '';
          html += `<div class="form-check mb-2"><input type="radio" name="${q.qId}" value="${opt}" class="form-check-input" ${checked}> <label class="form-check-label">${opt}</label></div>`;
        });
      } else if (q.type === '多選') {
        let valArr = val.split(',');
        q.options.forEach(opt => {
          const checked = valArr.includes(opt) ? 'checked' : '';
          html += `<div class="form-check mb-2"><input type="checkbox" name="${q.qId}" value="${opt}" class="form-check-input" ${checked}> <label class="form-check-label">${opt}</label></div>`;
        });
      } else if (q.type === '數字' || q.type === '溫度') {
        html += `<input type="number" step="any" id="${q.qId}" class="form-control form-control-lg bg-light border-0 shadow-sm" value="${val}">`;
      } else if (q.type === '照片') {
        if(mode === 'edit' && val.startsWith('http')) {
          html += `<div class="mb-2"><img src="${val}" class="img-fluid rounded shadow-sm" style="max-height:200px;"></div><small class="text-muted d-block mb-2">上傳新照將覆蓋</small>`;
        }
        html += `<input type="file" accept="image/*" class="form-control" id="${q.qId}">`;
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
    app.cache = {}; // 刪除後清除所有快取
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

    const payload = {
      action: 'submitForm', empId: app.user.empId, flowId: app.currentFlow.id, answers: answers,
      recordId: app.formMode === 'edit' ? app.currentFlow.recordId : null
    };

    const res = await app.api(payload);
    app.cache = {}; // 存檔後強制清空快取確保資料最新
    if (res.exceptionTriggered) alert("儲存成功！注意：有異常數值，已通報處理。");
    else alert("儲存成功！");
    this.goBack();
  }
};
