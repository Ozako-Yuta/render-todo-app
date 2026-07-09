let currentYear, currentMonth;
let allTasks = [];

document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  loadCategories();
  loadTasks();

  document.getElementById('todo-form').addEventListener('submit', handleFormSubmit);
  document.getElementById('prev-month').addEventListener('click', () => { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } renderCalendar(); });
  document.getElementById('next-month').addEventListener('click', () => { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } renderCalendar(); });
  document.getElementById('category-form').addEventListener('submit', handleCategorySubmit);
});

async function loadCategories() {
  const res = await fetch('/categories');
  const categories = await res.json();
  
  // 1. タスク追加用のプルダウンを更新
  document.getElementById('task-category').innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  
  // 2. 💡【追記】カテゴリ管理リスト（削除ボタン付き）を更新
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
  const list = document.getElementById('task-list');
  list.innerHTML = allTasks.map(task => {
    const dateStr = new Date(task.deadline).toLocaleDateString('ja-JP');
    return `
      <li class="task-item ${task.is_completed ? 'completed' : ''}">
        <div>
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
  if (res.ok) { document.getElementById('todo-form').reset(); loadTasks(); }
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

  for (let i = 0; i < firstDay; i++) grid.appendChild(document.createElement('div'));

  for (let date = 1; date <= lastDate; date++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    cell.innerHTML = `<span class="day-num">${date}</span>`;

    const cellDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    const hasTask = allTasks.some(t => new Date(t.deadline).toISOString().split('T')[0] === cellDateStr && !t.is_completed);

    if (hasTask) {
      const dot = document.createElement('div');
      dot.className = 'has-task';
      cell.appendChild(dot);
    }
    grid.appendChild(cell);
  }
}

// 削除ボタンが押されたときに動く関数
async function deleteTask(id) {
  try {
    // サーバーの受付窓口に「消して！」とリクエストを送る
    const response = await fetch(`/api/tasks/${id}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      // 💡 location.reload() の代わりに、アプリ既存の更新関数を呼び出す
      loadTasks();
    } else {
      alert('削除に失敗しました');
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);
    alert('通信エラーが発生しました');
  }
}

//サーバーに名前を登録
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
    // 💡 alert の行を削除しました！これだけで煩わしさはゼロになります。
  } else {
    const errData = await res.json();
    alert(errData.error || 'カテゴリの追加に失敗しました');
  }
}

// カテゴリ削除ボタンが押されたときに動く関数
async function deleteCategory(id) {
  try {
    const res = await fetch(`/categories/${id}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      await loadCategories(); // カテゴリ一覧を最新にする
      loadTasks();           // タスク一覧も再読み込み（表示の崩れを防ぐため）
    } else {
      const errData = await res.json();
      // サーバーから返ってきたエラーメッセージ（タスクが残っている等）を表示
      alert(errData.error || 'カテゴリの削除に失敗しました');
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);
    alert('通信エラーが発生しました');
  }
}