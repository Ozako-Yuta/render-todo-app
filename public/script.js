let currentYear, currentMonth;
let allTasks = [];
// ⚙️ スコア計算用の重み変数（初期値）
let impWeight = 10;
let deadlineWeight = 1;

document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  // 1. まずユーザーが設定した「マイ・デフォルト値」を読み込む（なければ10と1）
  const defaultImp = localStorage.getItem('defaultImpWeight') !== null ? parseFloat(localStorage.getItem('defaultImpWeight')) : 10;
  const defaultDeadline = localStorage.getItem('defaultDeadlineWeight') !== null ? parseFloat(localStorage.getItem('defaultDeadlineWeight')) : 1;

  // 2. 現在のセッションの値を読み込む（なければ上記のデフォルト値）
  impWeight = localStorage.getItem('impWeight') !== null ? parseFloat(localStorage.getItem('impWeight')) : defaultImp;
  deadlineWeight = localStorage.getItem('deadlineWeight') !== null ? parseFloat(localStorage.getItem('deadlineWeight')) : defaultDeadline;

  // 入力フォームへの反映
  const impInput = document.getElementById('weight-importance');
  const deadlineInput = document.getElementById('weight-deadline');
  const saveDefaultBtn = document.getElementById('btn-save-default');
  const restoreDefaultBtn = document.getElementById('btn-restore-default');

  if (impInput && deadlineInput) {
    impInput.value = impWeight;
    deadlineInput.value = deadlineWeight;

    // 数値変更時のリアルタイムイベント
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

  // 💾 「デフォルトとして設定」ボタンのイベント（確認フェーズの追加 ＆ 完了通知の廃止）
  if (saveDefaultBtn) {
    saveDefaultBtn.addEventListener('click', () => {
      const isConfirmed = confirm(`現在の設定（重要度: ${impWeight}倍 / 期限: ${deadlineWeight}倍）を新しいデフォルト値として登録しますか？`);
      if (isConfirmed) {
        localStorage.setItem('defaultImpWeight', impWeight);
        localStorage.setItem('defaultDeadlineWeight', deadlineWeight);
        // アクション完了後の不要なアラートは出さずに静かに処理を終えます
      }
    });
  }

  // 🔄 「デフォルトに戻す」ボタンのイベント
  if (restoreDefaultBtn) {
    restoreDefaultBtn.addEventListener('click', () => {
      const dImp = localStorage.getItem('defaultImpWeight') !== null ? parseFloat(localStorage.getItem('defaultImpWeight')) : 10;
      const dDeadline = localStorage.getItem('defaultDeadlineWeight') !== null ? parseFloat(localStorage.getItem('defaultDeadlineWeight')) : 1;
      
      impWeight = dImp;
      deadlineWeight = dDeadline;
      
      if (impInput) impInput.value = impWeight;
      if (deadlineInput) deadlineInput.value = deadlineWeight;
      
      localStorage.setItem('impWeight', impWeight);
      localStorage.setItem('deadlineWeight', deadlineWeight);
      renderTaskList(); // リストを登録したデフォルト順に再描画
    });
  }

  loadCategories();
  loadTasks();

  document.getElementById('todo-form').addEventListener('submit', handleFormSubmit);
  document.getElementById('category-form').addEventListener('submit', handleCategorySubmit);
  
  document.getElementById('prev-month').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar();
  });
  
  document.getElementById('next-month').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar();
  });
});

async function loadCategories() {
  const res = await fetch('/categories');
  const categories = await res.json();
  
  document.getElementById('task-category').innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  
  const managementList = document.getElementById('category-management-list');
  if (managementList) {
    managementList.innerHTML = categories.map(c => `
      <li style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f9f9f9; font-size: 14px;">
        <span>${c.name}</span>
        <button class="delete-btn" style="padding: 3px 8px; font-size: 11px; margin: 0;" onclick="deleteCategory(${c.id})">削除</button>
      </li>
    `).join('');
  }
}

async function loadTasks() {
  const res = await fetch('/tasks');
  allTasks = await res.json();
  renderTaskList();
  renderCalendar();
}

function renderTaskList() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sortedTasks = [...allTasks].sort((a, b) => {
    if (a.is_completed !== b.is_completed) {
      return a.is_completed ? 1 : -1;
    }

    const calcScore = (task) => {
      let score = task.importance * impWeight;
      
      if (task.deadline) {
        const deadlineDate = new Date(task.deadline);
        deadlineDate.setHours(0, 0, 0, 0);
        const daysLeft = Math.round((deadlineDate - today) / (1000 * 60 * 60 * 24));
        score -= (daysLeft * deadlineWeight);
      }
      return score;
    };

    return calcScore(b) - calcScore(a);
  });

  const list = document.getElementById('task-list');
  list.innerHTML = sortedTasks.map(task => {
    const dateStr = task.deadline ? new Date(task.deadline).toLocaleDateString('ja-JP') : 'なし';
    return `
      <li class="task-item ${task.is_completed ? 'completed' : ''}">
        <div class="task-info">
          <input type="checkbox" ${task.is_completed ? 'checked' : ''} onchange="toggleTask(${task.id}, this.checked)">
          <span class="task-title-text"><strong>[${task.category.name}]</strong> ${task.title}</span>
        </div>
        <div>
          <span class="badge imp-${task.importance}">重要度:${task.importance}</span>
          <span class="badge">期限:${dateStr}</span>
          <button class="delete-btn" onclick="deleteTask(${task.id})">削除</button>
        </div>
      </li>
    `;
  }).join('');

  const noDeadlineList = document.getElementById('no-deadline-list');
  if (noDeadlineList) {
    const noDeadlineTasks = sortedTasks.filter(task => !task.deadline);
    
    if (noDeadlineTasks.length === 0) {
      noDeadlineList.innerHTML = '<li style="color: #aaa; font-size: 14px; padding: 5px 0;">なし</li>';
    } else {
      noDeadlineList.innerHTML = noDeadlineTasks.map(task => `
        <li class="task-item ${task.is_completed ? 'completed' : ''}" style="padding: 8px 0;">
          <div class="task-info">
            <input type="checkbox" ${task.is_completed ? 'checked' : ''} onchange="toggleTask(${task.id}, this.checked)">
            <span class="task-title-text" style="font-size: 14px;"><strong>[${task.category.name}]</strong> ${task.title}</span>
          </div>
          <div>
            <span class="badge imp-${task.importance}">重要度:${task.importance}</span>
            <button class="delete-btn" style="padding: 3px 8px; font-size: 11px; margin: 0 0 0 5px;" onclick="deleteTask(${task.id})">削除</button>
          </div>
        </li>
      `).join('');
    }
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('task-title').value;
  const deadline = document.getElementById('task-deadline').value;
  const importance = document.getElementById('task-importance').value;
  const category_id = document.getElementById('task-category').value;

  const res = await fetch('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, deadline, importance, category_id })
  });
  if (res.ok) { 
    document.getElementById('todo-form').reset(); 
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
  } catch (error) {
    console.error('ステータス更新エラー:', error);
  }
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
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

    const targetDateStr = new Date(currentYear, currentMonth, date).toLocaleDateString('ja-JP');
    
    const dayTasks = allTasks.filter(t => {
      if (!t.deadline || t.is_completed) return false;
      return new Date(t.deadline).toLocaleDateString('ja-JP') === targetDateStr;
    });

    if (dayTasks.length > 0) {
      const maxImportance = Math.max(...dayTasks.map(t => t.importance));
      
      const dot = document.createElement('div');
      dot.className = `has-task imp-${maxImportance}`;
      cell.appendChild(dot);
    }
    grid.appendChild(cell);
  }
}

async function deleteTask(id) {
  try {
    const response = await fetch(`/api/tasks/${id}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      loadTasks();
    } else {
      alert('削除に失敗しました');
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);
    alert('通信エラーが発生しました');
  }
}

async function handleCategorySubmit(e) {
  e.preventDefault();
  const nameInput = document.getElementById('new-category-name');
  const name = nameInput.value.trim();

  const res = await fetch('/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });

  if (res.ok) {
    nameInput.value = ''; 
    await loadCategories(); 
  } else {
    const errData = await res.json();
    alert(errData.error || 'カテゴリの追加に失敗しました');
  }
}

async function deleteCategory(id) {
  try {
    const res = await fetch(`/categories/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      await loadCategories();
      loadTasks(); 
    } else {
      const errData = await res.json();
      alert(errData.error || 'カテゴリの削除に失敗しました');
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);
    alert('通信エラーが発生しました');
  }
}