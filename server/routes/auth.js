/**
 * 认证路由
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 3.1
 */

const express = require('express');
const router = express.Router();
const { hashPassword, verifyPassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');
const { query, queryOne, run } = require('../db');
const authMiddleware = require('../middleware/auth');

/**
 * 验证用户名
 * @param {string} username 
 * @returns {{ valid: boolean, error?: string }}
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: '请输入有效用户名' };
  }
  
  const trimmed = username.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: '请输入有效用户名' };
  }
  
  return { valid: true };
}

/**
 * 验证密码
 * @param {string} password 
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: '密码长度至少6位' };
  }
  
  if (password.length < 6) {
    return { valid: false, error: '密码长度至少6位' };
  }
  
  return { valid: true };
}

/**
 * POST /api/auth/register - 用户注册
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 验证用户名
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return res.status(400).json({
        success: false,
        error: usernameValidation.error
      });
    }
    
    // 验证密码
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: passwordValidation.error
      });
    }
    
    const trimmedUsername = username.trim();
    
    // 检查用户名是否已存在
    const existingUser = queryOne(
      'SELECT id FROM users WHERE username = ?',
      [trimmedUsername]
    );
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: '用户名已存在'
      });
    }
    
    // 哈希密码
    const passwordHash = await hashPassword(password);
    
    // 创建用户
    const result = run(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [trimmedUsername, passwordHash]
    );
    
    const userId = result.lastInsertRowid;
    
    // 生成 token
    const token = generateToken({ id: userId, username: trimmedUsername });
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: userId,
        username: trimmedUsername
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
});

/**
 * POST /api/auth/login - 用户登录
 * Requirements: 2.1, 2.2
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 基本验证
    if (!username || !password) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }
    
    const trimmedUsername = typeof username === 'string' ? username.trim() : '';
    
    // 查找用户
    const user = queryOne(
      'SELECT id, username, password_hash FROM users WHERE username = ?',
      [trimmedUsername]
    );
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }
    
    // 验证密码
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }
    
    // 生成 token
    const token = generateToken({ id: user.id, username: user.username });
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
});

/**
 * POST /api/auth/logout - 用户登出
 * Requirements: 3.1
 * 
 * 注意：由于使用 JWT，服务端不维护会话状态，
 * 登出主要由客户端清除 token 实现。
 * 此接口仅返回成功响应，实际的 token 失效由客户端处理。
 */
router.post('/logout', (req, res) => {
  // JWT 是无状态的，服务端不需要做特殊处理
  // 客户端负责清除本地存储的 token
  res.json({
    success: true
  });
});

/**
 * GET /api/auth/me - 获取当前用户信息
 * Requirements: 2.4
 * 
 * 需要认证中间件验证 token
 */
router.get('/me', authMiddleware, (req, res) => {
  // req.user 由 authMiddleware 设置
  res.json({
    success: true,
    user: {
      id: req.user.id,
      username: req.user.username
    }
  });
});

module.exports = router;

// 导出验证函数供测试使用
module.exports.validateUsername = validateUsername;
module.exports.validatePassword = validatePassword;
