const jwt = require('jsonwebtoken');

// JWT 密钥，生产环境应从环境变量读取
const JWT_SECRET = process.env.JWT_SECRET || 'sales-data-secret-key-2024';

// Token 过期时间：7天
const TOKEN_EXPIRY = '7d';
const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 604800 秒

/**
 * 生成 JWT Token
 * @param {Object} payload - Token 载荷，通常包含用户信息
 * @param {number} payload.id - 用户ID
 * @param {string} payload.username - 用户名
 * @returns {string} - JWT Token
 */
function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * 验证 JWT Token
 * @param {string} token - JWT Token
 * @returns {{ valid: boolean, payload?: Object, error?: string }}
 */
function verifyToken(token) {
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        return { valid: true, payload };
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return { valid: false, error: '请重新登录' };
        }
        return { valid: false, error: 'Token 无效' };
    }
}

module.exports = {
    generateToken,
    verifyToken,
    JWT_SECRET,
    TOKEN_EXPIRY,
    TOKEN_EXPIRY_SECONDS
};
