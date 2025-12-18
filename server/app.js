/**
 * Express 应用主文件
 * Requirements: 5.1
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// 中间件配置
app.use(cors({
  origin: true, // 允许所有来源，生产环境应配置具体域名
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// 路由
const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');

app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 静态文件服务 - 提供前端文件
app.use(express.static(path.join(__dirname, '..')));

// 前端路由 - 返回 index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// 404 处理 - 只对 API 路由返回 JSON
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ success: false, error: '服务器错误' });
});

module.exports = app;
