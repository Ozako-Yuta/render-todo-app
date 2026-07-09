const express = require('express');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 起動時にカテゴリが空なら自動でシードデータを投入
async function seedCategories() {
  const count = await prisma.category.count();
  if (count === 0) {
    await prisma.category.createMany({
      data: [{ name: '仕事' }, { name: 'プライベート' }, { name: '勉強' }, { name: '買い物' }]
    });
    console.log('初期カテゴリを登録しました。');
  }
}
seedCategories();

// 【API】カテゴリ一覧の取得
app.get('/categories', async (req, res) => {
  const categories = await prisma.category.findMany();
  res.json(categories);
});

// 【API】新しいカテゴリの追加
app.post('/categories', async (req, res) => {
  const { name } = req.body;
  try {
    const newCategory = await prisma.category.create({
      data: { name }
    });
    res.json(newCategory);
  } catch (error) {
    res.status(400).json({ error: "そのカテゴリは既に存在するか、作成に失敗しました" });
  }
});

// 【API】タスク一覧取得（オススメ順計算）
app.get('/tasks', async (req, res) => {
  try {
    const now = new Date();
    // カテゴリ情報を含めてデータベースから全取得
    const tasks = await prisma.task.findMany({
      include: {
        category: true
      }
    });
    
    // 【オススメ順の計算ロジック】
    // スコア = (重要度 * 10) - (締め切りまでの残り日数)
    // 未完了タスクを優先し、スコアが高い順（降順）にソート
    const sortedTasks = tasks.sort((a, b) => {
      if (a.is_completed !== b.is_completed) {
        return a.is_completed ? 1 : -1; 
      }
      const daysLeftA = (new Date(a.deadline) - now) / (1000 * 60 * 60 * 24);
      const daysLeftB = (new Date(b.deadline) - now) / (1000 * 60 * 60 * 24);

      const scoreA = (a.importance * 10) - daysLeftA;
      const scoreB = (b.importance * 10) - daysLeftB;

      return scoreB - scoreA; 
    });

    res.json(sortedTasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 【API】新しいタスクの保存
app.post('/tasks', async (req, res) => {
  const { title, deadline, importance, category_id } = req.body;
  try {
    const newTask = await prisma.task.create({
      data: {
        title,
        deadline: new Date(deadline),
        importance: Number(importance),
        categoryId: Number(category_id)
      }
    });
    res.json(newTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "タスクの追加に失敗しました" });
  }
});

// 【API】タスクを削除する受付窓口
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.task.delete({
      where: { 
        id: Number(id)
      },
    });
    res.json({ success: true, message: '削除に成功しました' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '削除に失敗しました' });
  }
});

// 【API】カテゴリを削除する受付窓口
app.delete('/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.category.delete({
      where: { 
        id: Number(id) 
      }
    });
    res.json({ success: true, message: 'カテゴリを削除しました' });
  } catch (error) {
    // 💡 Prismaのエラーコード「P2003」は、他のデータ（タスク）がこのカテゴリを使っているという意味です
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'このカテゴリを使用しているタスクが残っているため、削除できません。' });
    }
    console.error(error);
    res.status(500).json({ error: 'カテゴリの削除に失敗しました' });
  }
});

// 【API】タスクのステータス更新（完了・未完了の切り替え用）
app.patch('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { is_completed } = req.body;
  try {
    const updatedTask = await prisma.task.update({
      where: { id: parseInt(id) },
      data: { is_completed }
    });
    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});