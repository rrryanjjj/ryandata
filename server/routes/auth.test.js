const fc = require('fast-check');
const { initDatabase, closeDatabase, query, run } = require('../db');
const { validateUsername, validatePassword } = require('./auth');
const { hashPassword } = require('../utils/password');
const { generateToken, verifyToken } = require('../utils/jwt');

// 测试前初始化数据库
beforeAll(async () => {
    await initDatabase();
});

// 每个测试后清理用户数据
afterEach(() => {
    run('DELETE FROM users');
});

// 测试后关闭数据库
afterAll(() => {
    closeDatabase();
});

/**
 * 辅助函数：创建用户
 */
async function createUser(username, password) {
    const passwordHash = await hashPassword(password);
    const result = run(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        [username, passwordHash]
    );
    return result.lastInsertRowid;
}

/**
 * 辅助函数：模拟注册流程
 */
async function simulateRegister(username, password) {
    // 验证用户名
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
        return { success: false, error: usernameValidation.error };
    }
    
    // 验证密码
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        return { success: false, error: passwordValidation.error };
    }
    
    const trimmedUsername = username.trim();
    
    // 检查用户名是否已存在
    const existingUser = query(
        'SELECT id FROM users WHERE username = ?',
        [trimmedUsername]
    );
    
    if (existingUser.length > 0) {
        return { success: false, error: '用户名已存在' };
    }
    
    // 哈希密码并创建用户
    const passwordHash = await hashPassword(password);
    const result = run(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        [trimmedUsername, passwordHash]
    );
    
    const userId = result.lastInsertRowid;
    const token = generateToken({ id: userId, username: trimmedUsername });
    
    return {
        success: true,
        token,
        user: { id: userId, username: trimmedUsername }
    };
}

/**
 * **Feature: user-auth-cloud-storage, Property 1: 注册成功产生有效会话**
 * 
 * *对于任意*有效的用户名（非空且不全为空白字符）和有效的密码（长度>=6），
 * 注册成功后系统应返回有效的 token，且用户处于登录状态。
 * 
 * **Validates: Requirements 1.1, 1.5**
 */
describe('Property 1: 注册成功产生有效会话', () => {
    test('有效用户名和密码注册后返回有效 token', async () => {
        await fc.assert(
            fc.asyncProperty(
                // 生成有效用户名：非空且不全为空白字符
                fc.string({ minLength: 1, maxLength: 30 })
                    .filter(s => s.trim().length > 0)
                    .map(s => s.replace(/['"\\;]/g, 'x')), // 避免特殊字符
                // 生成有效密码：长度 >= 6
                fc.string({ minLength: 6, maxLength: 50 }),
                async (username, password) => {
                    // 清理之前的数据
                    run('DELETE FROM users');
                    
                    const result = await simulateRegister(username, password);
                    
                    // 注册应该成功
                    expect(result.success).toBe(true);
                    expect(result.token).toBeDefined();
                    expect(result.user).toBeDefined();
                    expect(result.user.username).toBe(username.trim());
                    
                    // Token 应该有效
                    const tokenResult = verifyToken(result.token);
                    expect(tokenResult.valid).toBe(true);
                    expect(tokenResult.payload.id).toBe(result.user.id);
                    expect(tokenResult.payload.username).toBe(username.trim());
                }
            ),
            { numRuns: 20 } // 减少运行次数，因为密码哈希较慢
        );
    }, 60000); // 增加超时时间到60秒
});

/**
 * **Feature: user-auth-cloud-storage, Property 2: 重复用户名注册被拒绝**
 * 
 * *对于任意*已注册的用户名，使用相同用户名再次注册应返回"用户名已存在"错误，且不创建新用户。
 * 
 * **Validates: Requirements 1.2**
 */
describe('Property 2: 重复用户名注册被拒绝', () => {
    test('重复用户名注册返回错误', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 30 })
                    .filter(s => s.trim().length > 0)
                    .map(s => s.replace(/['"\\;]/g, 'x')),
                fc.string({ minLength: 6, maxLength: 50 }),
                fc.string({ minLength: 6, maxLength: 50 }),
                async (username, password1, password2) => {
                    // 清理之前的数据
                    run('DELETE FROM users');
                    
                    // 第一次注册应该成功
                    const firstResult = await simulateRegister(username, password1);
                    expect(firstResult.success).toBe(true);
                    
                    // 记录当前用户数量
                    const userCountBefore = query('SELECT COUNT(*) as count FROM users')[0].count;
                    
                    // 第二次使用相同用户名注册应该失败
                    const secondResult = await simulateRegister(username, password2);
                    expect(secondResult.success).toBe(false);
                    expect(secondResult.error).toBe('用户名已存在');
                    
                    // 用户数量不应增加
                    const userCountAfter = query('SELECT COUNT(*) as count FROM users')[0].count;
                    expect(userCountAfter).toBe(userCountBefore);
                }
            ),
            { numRuns: 20 } // 减少运行次数，因为密码哈希较慢
        );
    }, 60000); // 增加超时时间到60秒
});

/**
 * **Feature: user-auth-cloud-storage, Property 3: 短密码被拒绝**
 * 
 * *对于任意*长度小于6的密码字符串，注册请求应返回密码长度错误，且不创建用户。
 * 
 * **Validates: Requirements 1.3**
 */
describe('Property 3: 短密码被拒绝', () => {
    test('短密码注册返回错误', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 30 })
                    .filter(s => s.trim().length > 0)
                    .map(s => s.replace(/['"\\;]/g, 'x')),
                // 生成短密码：长度 < 6
                fc.string({ minLength: 0, maxLength: 5 }),
                async (username, shortPassword) => {
                    // 清理之前的数据
                    run('DELETE FROM users');
                    
                    const userCountBefore = query('SELECT COUNT(*) as count FROM users')[0].count;
                    
                    const result = await simulateRegister(username, shortPassword);
                    
                    // 注册应该失败
                    expect(result.success).toBe(false);
                    expect(result.error).toBe('密码长度至少6位');
                    
                    // 用户数量不应增加
                    const userCountAfter = query('SELECT COUNT(*) as count FROM users')[0].count;
                    expect(userCountAfter).toBe(userCountBefore);
                }
            ),
            { numRuns: 100 }
        );
    });
});

/**
 * **Feature: user-auth-cloud-storage, Property 4: 空白用户名被拒绝**
 * 
 * *对于任意*空字符串或仅包含空白字符的用户名，注册请求应返回无效用户名错误。
 * 
 * **Validates: Requirements 1.4**
 */
describe('Property 4: 空白用户名被拒绝', () => {
    test('空白用户名注册返回错误', async () => {
        await fc.assert(
            fc.asyncProperty(
                // 生成空白用户名：空字符串或仅包含空白字符
                fc.oneof(
                    fc.constant(''),
                    fc.constant(null),
                    fc.constant(undefined),
                    fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'))
                        .filter(s => s === '' || s.trim().length === 0)
                ),
                fc.string({ minLength: 6, maxLength: 50 }),
                async (blankUsername, password) => {
                    // 清理之前的数据
                    run('DELETE FROM users');
                    
                    const userCountBefore = query('SELECT COUNT(*) as count FROM users')[0].count;
                    
                    const result = await simulateRegister(blankUsername, password);
                    
                    // 注册应该失败
                    expect(result.success).toBe(false);
                    expect(result.error).toBe('请输入有效用户名');
                    
                    // 用户数量不应增加
                    const userCountAfter = query('SELECT COUNT(*) as count FROM users')[0].count;
                    expect(userCountAfter).toBe(userCountBefore);
                }
            ),
            { numRuns: 100 }
        );
    });
});


/**
 * 辅助函数：模拟登录流程
 */
async function simulateLogin(username, password) {
    // 基本验证
    if (!username || !password) {
        return { success: false, error: '用户名或密码错误' };
    }
    
    const trimmedUsername = typeof username === 'string' ? username.trim() : '';
    
    // 查找用户
    const users = query(
        'SELECT id, username, password_hash FROM users WHERE username = ?',
        [trimmedUsername]
    );
    
    if (users.length === 0) {
        return { success: false, error: '用户名或密码错误' };
    }
    
    const user = users[0];
    
    // 验证密码
    const { verifyPassword } = require('../utils/password');
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    
    if (!isPasswordValid) {
        return { success: false, error: '用户名或密码错误' };
    }
    
    // 生成 token
    const token = generateToken({ id: user.id, username: user.username });
    
    return {
        success: true,
        token,
        user: { id: user.id, username: user.username }
    };
}

/**
 * **Feature: user-auth-cloud-storage, Property 5: 正确凭证登录成功**
 * 
 * *对于任意*已注册的用户，使用正确的用户名和密码登录应返回有效 token 并创建会话。
 * 
 * **Validates: Requirements 2.1**
 */
describe('Property 5: 正确凭证登录成功', () => {
    test('正确凭证登录返回有效 token', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 30 })
                    .filter(s => s.trim().length > 0)
                    .map(s => s.replace(/['"\\;]/g, 'x')),
                fc.string({ minLength: 6, maxLength: 50 }),
                async (username, password) => {
                    // 清理之前的数据
                    run('DELETE FROM users');
                    
                    // 先注册用户
                    const registerResult = await simulateRegister(username, password);
                    expect(registerResult.success).toBe(true);
                    
                    // 使用正确凭证登录
                    const loginResult = await simulateLogin(username, password);
                    
                    // 登录应该成功
                    expect(loginResult.success).toBe(true);
                    expect(loginResult.token).toBeDefined();
                    expect(loginResult.user).toBeDefined();
                    expect(loginResult.user.username).toBe(username.trim());
                    
                    // Token 应该有效
                    const tokenResult = verifyToken(loginResult.token);
                    expect(tokenResult.valid).toBe(true);
                    expect(tokenResult.payload.username).toBe(username.trim());
                }
            ),
            { numRuns: 20 } // 减少运行次数，因为密码哈希较慢
        );
    }, 60000);
});

/**
 * **Feature: user-auth-cloud-storage, Property 6: 错误凭证登录失败**
 * 
 * *对于任意*用户名和密码组合，如果用户名不存在或密码不匹配，登录应返回"用户名或密码错误"。
 * 
 * **Validates: Requirements 2.2**
 */
describe('Property 6: 错误凭证登录失败', () => {
    test('不存在的用户名登录失败', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 30 })
                    .filter(s => s.trim().length > 0)
                    .map(s => s.replace(/['"\\;]/g, 'x')),
                fc.string({ minLength: 6, maxLength: 50 }),
                async (username, password) => {
                    // 清理之前的数据，确保用户不存在
                    run('DELETE FROM users');
                    
                    // 尝试登录不存在的用户
                    const loginResult = await simulateLogin(username, password);
                    
                    // 登录应该失败
                    expect(loginResult.success).toBe(false);
                    expect(loginResult.error).toBe('用户名或密码错误');
                }
            ),
            { numRuns: 100 }
        );
    });
    
    test('错误密码登录失败', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 30 })
                    .filter(s => s.trim().length > 0)
                    .map(s => s.replace(/['"\\;]/g, 'x')),
                fc.string({ minLength: 6, maxLength: 50 }),
                fc.string({ minLength: 6, maxLength: 50 })
                    .filter(s => s.length >= 6), // 确保是有效密码格式
                async (username, correctPassword, wrongPassword) => {
                    // 跳过密码相同的情况
                    if (correctPassword === wrongPassword) return;
                    
                    // 清理之前的数据
                    run('DELETE FROM users');
                    
                    // 先注册用户
                    const registerResult = await simulateRegister(username, correctPassword);
                    expect(registerResult.success).toBe(true);
                    
                    // 使用错误密码登录
                    const loginResult = await simulateLogin(username, wrongPassword);
                    
                    // 登录应该失败
                    expect(loginResult.success).toBe(false);
                    expect(loginResult.error).toBe('用户名或密码错误');
                }
            ),
            { numRuns: 20 } // 减少运行次数，因为密码哈希较慢
        );
    }, 60000);
});
