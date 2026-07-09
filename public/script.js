let currentYear, currentMonth;
let allTasks = [];

document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

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
  // 1. 左側のメインリスト（全タスク）の描画
  const list = document.getElementById('task-list');
  list.innerHTML = allTasks.map(task => {
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

  // 2. 右側の「期限のないタスク」欄の描画
  const noDeadlineList = document.getElementById('no-deadline-list');
  if (noDeadlineList) {
    const noDeadlineTasks = allTasks.filter(task => !task.deadline);
    
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
  await fetch(`/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_completed })
  });
  loadTasks();
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

    // 💡 タイムゾーンのバグを防ぐため、ローカル日付文字列で比較する安全な方法に修正
    const targetDateStr = new Date(currentYear, currentMonth, date).toLocaleDateString('ja-JP');
    const hasTask = allTasks.some(t => {
      if (!t.deadline || t.is_completed) return false;
      return new Date(t.deadline).toLocaleDateString('ja-JP') === targetDateStr;
    });

    if (hasTask) {
      const dot = document.createElement('div');
      dot.className = 'has-task';
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