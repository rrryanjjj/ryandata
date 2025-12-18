/**
 * 服务器入口文件
 * Requirements: 5.1
 */

const app = require('./app');
const { initDatabase, closeDatabase } = require('./db');

// 端口配置：优先使用环境变量，默认 3000
const PORT = process.env.PORT || 3000;

let server;

// 初始化数据库后启动服务器
async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化成功');
    
    server = app.listen(PORT, () => {
      console.log(`服务器已启动，端口: ${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();

// 优雅关闭处理
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  closeDatabase();
  if (server) {
    server.close(() => {
      console.log('服务器已关闭');
      process.exit(0);
    });
  }
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信号，正在关闭服务器...');
  closeDatabase();
  if (server) {
    server.close(() => {
      console.log('服务器已关闭');
      process.exit(0);
    });
  }
});

module.exports = app;
