let currentYear, currentMonth;
let allTasks = [];
let impWeight = 10;
let deadlineWeight = 1;
let cachedCategories = []; 

// localStorageから数値を取得する共通ヘルパー
const getStorageFloat = (key, defaultValue) => {
  const val = localStorage.getItem(key);
  return val !== null ? parseFloat(val) : defaultValue;
};

document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  const defaultImp = getStorageFloat('defaultImpWeight', 10);
  const defaultDeadline = getStorageFloat('defaultDeadlineWeight', 1);
  impWeight = getStorageFloat('impWeight', defaultImp);
  deadlineWeight = getStorageFloat('deadlineWeight', defaultDeadline);

  const impInput = document.getElementById('weight-importance');
  const deadlineInput = document.getElementById('weight-deadline');
  const saveDefaultBtn = document.getElementById('btn-save-default');
  const restoreDefaultBtn = document.getElementById('btn-restore-default');

  if (impInput && deadlineInput) {
    impInput.value = impWeight;
    deadlineInput.value = deadlineWeight;

    impInput.addEventListener('input', (e) => {
      impWeight = parseFloat(e.target.value) || 0;
      localStorage.setItem('impWeight', impWeight);
      renderTaskList();
    });

    deadlineInput.addEventListener('input', (e) => {
      deadlineWeight = parseFloat(e.target.value) || 0;
      localStorage.setItem('deadlineWeight', deadlineWeight);
      renderTaskList();
    });
  }

  if (saveDefaultBtn) {
    saveDefaultBtn.addEventListener('click', () => {
      if (confirm(`現在の設定（重要度: ${impWeight}倍 / 期限: ${deadlineWeight}倍）を新しいデフォルト値として登録しますか？`)) {
        localStorage.setItem('defaultImpWeight', impWeight);
        localStorage.setItem('defaultDeadlineWeight', deadlineWeight);
      }
    });
  }

  if (restoreDefaultBtn) {
    restoreDefaultBtn.addEventListener('click', () => {
      impWeight = getStorageFloat('defaultImpWeight', 10);
      deadlineWeight = getStorageFloat('defaultDeadlineWeight', 1);
      if (impInput) impInput.value = impWeight;
      if (deadlineInput) deadlineInput.value = deadlineWeight;
      localStorage.setItem('impWeight', impWeight);
      localStorage.setItem('deadlineWeight', deadlineWeight);
      renderTaskList();
    });
  }

  // ドロップダウンUI制御
  const dropdownTrigger = document.getElementById('dropdown-trigger');
  const dropdownMenu = document.getElementById('dropdown-menu');
  const inlineAddTrigger = document.getElementById('inline-add-trigger');
  const inlineAddForm = document.getElementById('inline-add-form');
  const inlineCategoryInput = document.getElementById('inline-category-name');
  const btnInlineCategorySave = document.getElementById('btn-inline-category-save');

  dropdownTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdownMenu.classList.contains('show');
    closeAllDropdowns();
    if (!isOpen) dropdownMenu.classList.add('show');
  });

  inlineAddTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    inlineAddTrigger.style.display = 'none';
    inlineAddForm.style.display = 'flex';
    inlineCategoryInput.focus();
  });

  inlineAddForm.addEventListener('click', (e) => e.stopPropagation());

  const submitInlineCategory = async () => {
    const name = inlineCategoryInput.value.trim();
    if (!name) return;

    const res = await fetch('/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    if (res.ok) {
      inlineCategoryInput.value = '';
      inlineAddForm.style.display = 'none';
      inlineAddTrigger.style.display = 'block';
      await loadCategories(name); 
    } else {
      const errData = await res.json();
      alert(errData.error || 'カテゴリの追加に失敗しました');
    }
  };

  btnInlineCategorySave.addEventListener('click', (e) => {
    e.stopPropagation();
    submitInlineCategory();
  });

  inlineCategoryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      submitInlineCategory();
    }
  });

  document.addEventListener('click', () => closeAllDropdowns());

  function closeAllDropdowns() {
    if(dropdownMenu) dropdownMenu.classList.remove('show');
    if(inlineAddForm) inlineAddForm.style.display = 'none';
    if(inlineAddTrigger) inlineAddTrigger.style.display = 'block';
  }

  loadTasks();

  document.getElementById('todo-form').addEventListener('submit', handleFormSubmit);
  
  document.getElementById('prev-month').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  });
  
  document.getElementById('next-month').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  });
});

// カテゴリ表示生成
async function loadCategories(autoSelectName = null) {
  try {
    const res = await fetch('/categories');
    cachedCategories = await res.json();
    
    const listContainer = document.getElementById('custom-category-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    cachedCategories.forEach(category => {
      const li = document.createElement('li');
      li.className = 'dropdown-item';
      
      const nameSpan = document.createElement('span');
      nameSpan.innerText = category.name;
      li.appendChild(nameSpan);

      // 🗑 削除ボタンの生成
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'inline-delete-btn';
      delBtn.innerText = '🗑';
      
      const hasActiveTasks = Array.isArray(allTasks) && allTasks.some(t => {
        const tCatId = t?.category_id || t?.category?.id;
        return tCatId == category.id && !t?.is_completed;
      });

      if (hasActiveTasks) {
        delBtn.disabled = true;
        delBtn.classList.add('disabled'); 
        delBtn.title = 'このカテゴリを使用中の未完了タスクがあるため削除できません';
      } else {
        delBtn.title = 'このカテゴリを削除';
        delBtn.addEventListener('click', async (event) => {
          event.preventDefault();
          event.stopPropagation(); 
          
          // 🛠️ ①の修正：confirmによる確認ダイアログを削除し、即時実行に変えました
          try {
            const delRes = await fetch(`/categories/${category.id}`, { method: 'DELETE' });
            if (delRes.ok) {
              if (document.getElementById('task-category-id').value == category.id) {
                clearCategorySelection();
              }
              await loadTasks(); 
            } else {
              alert('カテゴリの削除に失敗しました');
            }
          } catch (err) {
            console.error("削除通信エラー:", err);
          }
        });
      }

      li.appendChild(delBtn);

      li.addEventListener('click', (e) => {
        e.stopPropagation();
        selectCategory(category.id, category.name);
        document.getElementById('dropdown-menu').classList.remove('show');
      });

      listContainer.appendChild(li);
    });

    if (autoSelectName) {
      const target = cachedCategories.find(c => c.name === autoSelectName);
      if (target) selectCategory(target.id, target.name);
    } else if (cachedCategories.length > 0 && !document.getElementById('task-category-id').value) {
      selectCategory(cachedCategories[0].id, cachedCategories[0].name);
    }
  } catch (err) {
    console.error("カテゴリ描画中にエラーが発生しました:", err);
  }
}

function selectCategory(id, name) {
  const hiddenInput = document.getElementById('task-category-id');
  const label = document.getElementById('selected-category-label');
  if (hiddenInput) hiddenInput.value = id;
  if (label) label.innerText = name;
}

function clearCategorySelection() {
  const hiddenInput = document.getElementById('task-category-id');
  const label = document.getElementById('selected-category-label');
  if (hiddenInput) hiddenInput.value = '';
  if (label) label.innerText = 'カテゴリを選択';
}

async function loadTasks() {
  try {
    const res = await fetch('/tasks');
    allTasks = await res.json();
    await loadCategories();
    renderTaskList();
    renderCalendar();
  } catch (err) {
    console.error("タスク読み込みエラー:", err);
  }
}

// タスクのHTML文字列を生成する共通リファクタリング関数
function createTaskHTML(task, today) {
  const dateStr = task?.deadline ? new Date(task.deadline).toLocaleDateString('ja-JP') : 'なし';
  const catName = task?.category?.name || '未分類';
  
  let isOverdue = false;
  if (task?.deadline && !task?.is_completed) {
    const deadlineDate = new Date(task.deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    if (deadlineDate < today) isOverdue = true;
  }

  const deadlineBadge = task?.deadline 
    ? `<span class="badge ${isOverdue ? 'badge-overdue' : ''}">期限:${dateStr}</span>` 
    : '';

  return `
    <li class="task-item ${task?.is_completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}">
      <div class="task-info">
        <input type="checkbox" ${task?.is_completed ? 'checked' : ''} onchange="toggleTask(${task?.id}, this.checked)">
        <span class="task-title-text"><strong>[${catName}]</strong> ${task?.title || ''}</span>
      </div>
      <div>
        <span class="badge imp-${task?.importance || 1}">重要度:${task?.importance || 1}</span>
        ${deadlineBadge}
        <button class="delete-btn" onclick="deleteTask(${task?.id})">削除</button>
      </div>
    </li>
  `;
}

function renderTaskList() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sortedTasks = [...allTasks].sort((a, b) => {
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
    const calcScore = (task) => {
      let score = (task?.importance || 0) * impWeight;
      if (task?.deadline) {
        const deadlineDate = new Date(task.deadline);
        deadlineDate.setHours(0, 0, 0, 0);
        const daysLeft = Math.round((deadlineDate - today) / (1000 * 60 * 60 * 24));
        score -= (daysLeft * deadlineWeight);
      } else {
        // 🛠️ ③の修正：無期限タスクは「猶予がたっぷり（30日分）あるタスク」として扱い、スコアを低く抑えます
        score -= (30 * deadlineWeight);
      }
      return score;
    };
    return calcScore(b) - calcScore(a);
  });

  const list = document.getElementById('task-list');
  if (list) {
    list.innerHTML = sortedTasks.map(task => createTaskHTML(task, today)).join('');
  }

  const noDeadlineList = document.getElementById('no-deadline-list');
  if (noDeadlineList) {
    const noDeadlineTasks = sortedTasks.filter(task => !task?.deadline);
    if (noDeadlineTasks.length === 0) {
      noDeadlineList.innerHTML = '<li style="color: #aaa; font-size: 14px; padding: 5px 0;">なし</li>';
    } else {
      noDeadlineList.innerHTML = noDeadlineTasks.map(task => createTaskHTML(task, today)).join('');
    }
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('task-title').value;
  const deadline = document.getElementById('task-deadline').value;
  const importance = document.getElementById('task-importance').value;
  const category_id = document.getElementById('task-category-id').value; 

  if (!category_id) {
    alert('カテゴリを選択してください');
    return;
  }

  const res = await fetch('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, deadline, importance, category_id })
  });
  if (res.ok) { 
    document.getElementById('todo-form').reset(); 
    if (cachedCategories.length > 0) {
      selectCategory(cachedCategories[0].id, cachedCategories[0].name);
    } else {
      clearCategorySelection();
    }
    loadTasks(); 
  }
}

async function toggleTask(id, is_completed) {
  try {
    await fetch(`/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed })
    });
    loadTasks(); 
  } catch (error) { console.error(error); }
}

function renderCalendar() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const grid = document.getElementById('calendar-grid');
  if (!grid) return;
  grid.innerHTML = '';
  document.getElementById('calendar-month-year').innerText = `${currentYear}年 ${currentMonth + 1}月`;

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    grid.appendChild(document.createElement('div'));
  }

  for (let date = 1; date <= lastDate; date++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    cell.innerHTML = `<span class="day-num">${date}</span>`;

    const cellDate = new Date(currentYear, currentMonth, date);
    cellDate.setHours(0, 0, 0, 0);
    const targetDateStr = cellDate.toLocaleDateString('ja-JP');
    
    const dayTasks = allTasks.filter(t => {
      if (!t?.deadline || t?.is_completed) return false;
      return new Date(t.deadline).toLocaleDateString('ja-JP') === targetDateStr;
    });

    if (dayTasks.length > 0) {
      const dot = document.createElement('div');
      if (cellDate < today) {
        dot.className = 'has-task overdue';
      } else {
        const maxImportance = Math.max(...dayTasks.map(t => t?.importance || 1));
        dot.className = `has-task imp-${maxImportance}`;
      }
      cell.appendChild(dot);
    }
    grid.appendChild(cell);
  }
}

async function deleteTask(id) {
  try {
    // 🛠️ ②の修正：サーバーの設計に合わせて元の `/api/tasks/${id}` に差し戻しました
    const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (response.ok) { loadTasks(); } else { alert('削除に失敗しました'); }
  } catch (error) { console.error(error); alert('通信エラーが発生しました'); }
}