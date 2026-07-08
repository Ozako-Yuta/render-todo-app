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
});

async function loadCategories() {
  const res = await fetch('/categories');
  const categories = await res.json();
  document.getElementById('task-category').innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
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