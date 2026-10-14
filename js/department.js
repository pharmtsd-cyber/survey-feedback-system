app.department = {
  async loadDeptFlows(dept, menuItem = null) {
    if(menuItem) app.setActiveMenu(menuItem);
    app.currentDept = dept;
    app.switchView('view-dept-flows', `${dept} 問卷清單`);
    
    const targetDate = document.getElementById('target-date').value;
    const res = await app.api({ action: 'getDeptFlows', department: dept, targetDate: targetDate });
    
    // 渲染單位異常卡片
    document.getElementById('dept-exc-count').innerText = res.exceptionCount;
    let excHtml = '';
    if(res.exceptionsList.length > 0) {
      res.exceptionsList.forEach((e, i) => {
        let colId = `dept-exc-col-${i}`;
        excHtml += `
          <div class="accordion-item bg-transparent border-bottom border-light">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed bg-transparent text-white p-2" type="button" data-bs-toggle="collapse" data-bs-target="#${colId}">
                <strong class="fs-6 me-2">${e.flowName}</strong>
              </button>
            </h2>
            <div id="${colId}" class="accordion-collapse collapse" data-bs-parent="#dept-acc-exceptions">
              <div class="accordion-body p-2 pt-0 text-white-50 small">
                <div><i class="bi bi-person"></i> ${e.empName} ｜ <i class="bi bi-clock"></i> ${e.time}</div>
                <div class="mt-2 bg-white text-danger px-2 py-1 rounded fw-bold shadow-sm d-inline-block">${e.qTitle} : ${e.value}</div>
                <div class="mt-2 text-end">
                  <button class="btn btn-sm btn-light text-primary fw-bold shadow-sm" onclick="app.department.openForm('edit', '${e.flowId}', '${e.flowName}', '${e.recordId}')">前往回覆/修改 <i class="bi bi-arrow-right"></i></button>
                </div>
              </div>
            </div>
          </div>`;
      });
    } else {
      excHtml = '<div class="p-2 text-white">目前無異常。</div>';
    }
    document.getElementById('dept-acc-exceptions').innerHTML = excHtml;

    // 渲染單位未完成清單
    document.getElementById('dept-inc-list').innerHTML = res.incompleteList.length > 0
      ? res.incompleteList.map(f => `<li class="mb-2 fs-6 px-2 d-flex justify-content-between align-items-center"><div class="fw-bold"><i class="bi bi-x-circle text-danger me-2"></i> ${f.name}</div><button class="btn btn-sm btn-light text-dark fw-bold shadow-sm" onclick="app.department.openForm('new', '${f.id}', '${f.name}')">前往填寫</button></li>`).join('')
      : '<li class="px-2"><i class="bi bi-check-circle text-success fs-5 me-2"></i> 本日全數完成！</li>';

    // 渲染手風琴分類清單
    let html = '';
    let sortedCategories = Object.keys(res.categories).sort();
    
    sortedCategories.forEach(catName => {
      html += `<h5 class="fw-bold text-primary mt-4 mb-3 border-bottom pb-2"><i class="bi bi-tags"></i> ${catName}</h5>`;
      let flows = res.categories[catName];
      
      flows.forEach((f, index) => {
        let collapseId = `col-${f.id}`;
        if (f.count === 0) {
          html += `
            <div class="card border-0 shadow-sm mb-3">
              <button class="btn btn-light d-flex justify-content-between align-items-center p-3 text-start" onclick="app.department.openForm('new', '${f.id}', '${f.name}')">
                <strong class="fs-5">${f.name}</strong><span class="badge bg-secondary rounded-pill px-3 fs-6">未完成</span>
              </button>
            </div>`;
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
                <h2 class="accordion-header">
                  <button class="accordion-button collapsed bg-white text-dark rounded" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                    <strong class="fs-5">${f.name}</strong><span class="badge bg-success rounded-pill px-3 ms-auto fs-6">完成 ${f.count} 次</span>
                  </button>
                </h2>
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
      const val = oldAnswers[q.qId] || '';
      const reqMark = q.isRequired ? `<span class="text-danger ms-1">*</span>` : '';
      let html = `<div class="card mb-4 shadow-sm border-0"><div class="card-body"><h5 class="fw-bold mb-3">${q.title} ${reqMark}</h5>`;
      
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
    if (res.exceptionTriggered) alert("儲存成功！注意：有異常數值，已通報處理。");
    else alert("儲存成功！");
    this.goBack();
  }
};
