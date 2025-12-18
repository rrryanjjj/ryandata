const { verifyToken } = require('../utils/jwt');

/**
 * 认证中间件
 * 验证 Authorization header 中的 JWT Token
 * 
 * Requirements: 2.4, 2.5
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({
            success: false,
            error: '请重新登录'
        });
    }
    
    // 检查 Bearer token 格式
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({
            success: false,
            error: 'Token 无效'
        });
    }
    
    const token = parts[1];
    const result = verifyToken(token);
    
    if (!result.valid) {
        return res.status(401).json({
            success: false,
            error: result.error
        });
    }
    
    // 将用户信息附加到请求对象
    req.user = result.payload;
    next();
}

module.exports = authMiddleware;
