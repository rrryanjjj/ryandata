/**
 * AuthManager 前端输入验证属性测试
 * 
 * 测试 AuthManager 模块的 validateUsername 和 validatePassword 方法
 */

const fc = require('fast-check');

// 模拟浏览器环境的 localStorage
const localStorageMock = {
    store: {},
    getItem(key) {
        return this.store[key] || null;
    },
    setItem(key, value) {
        this.store[key] = value;
    },
    removeItem(key) {
        delete this.store[key];
    },
    clear() {
        this.store = {};
    },
    get length() {
        return Object.keys(this.store).length;
    },
    key(index) {
        return Object.keys(this.store)[index] || null;
    }
};

global.localStorage = localStorageMock;
global.fetch = jest.fn();

// 导入被测模块
const { AuthManager } = require('../app');

beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    AuthManager.token = null;
    AuthManager.currentUser = null;
});

/**
 * **Feature: user-auth-cloud-storage, Property 3: 短密码被拒绝**
 * 
 * *对于任意*长度小于6的密码字符串，注册请求应返回密码长度错误，且不创建用户。
 * 
 * **Validates: Requirements 1.3**
 */
describe('Property 3: 短密码被拒绝', () => {
    test('任意长度小于6的密码字符串应被拒绝', () => {
        fc.assert(
            fc.property(
                // 生成长度为 0-5 的任意字符串
                fc.string({ minLength: 0, maxLength: 5 }),
                (shortPassword) => {
                    const result = AuthManager.validatePassword(shortPassword);
                    
                    // 验证应该失败
                    expect(result.valid).toBe(false);
                    
                    // 应该返回正确的错误信息
                    expect(result.error).toBe('密码长度至少6位');
                }
            ),
            { numRuns: 100 }
        );
    });

    test('长度大于等于6的密码应被接受', () => {
        fc.assert(
            fc.property(
                // 生成长度为 6-50 的任意字符串
                fc.string({ minLength: 6, maxLength: 50 }),
                (validPassword) => {
                    const result = AuthManager.validatePassword(validPassword);
                    
                    // 验证应该成功
                    expect(result.valid).toBe(true);
                    
                    // 不应该有错误信息
                    expect(result.error).toBeUndefined();
                }
            ),
            { numRuns: 100 }
        );
    });

    test('null 和 undefined 密码应被拒绝', () => {
        const nullResult = AuthManager.validatePassword(null);
        expect(nullResult.valid).toBe(false);
        expect(nullResult.error).toBe('密码长度至少6位');

        const undefinedResult = AuthManager.validatePassword(undefined);
        expect(undefinedResult.valid).toBe(false);
        expect(undefinedResult.error).toBe('密码长度至少6位');
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
    test('任意仅包含空白字符的用户名应被拒绝', () => {
        fc.assert(
            fc.property(
                // 生成仅包含空白字符的字符串（空格、制表符、换行符等）
                fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\v')),
                (whitespaceUsername) => {
                    const result = AuthManager.validateUsername(whitespaceUsername);
                    
                    // 验证应该失败
                    expect(result.valid).toBe(false);
                    
                    // 应该返回正确的错误信息
                    expect(result.error).toBe('请输入有效用户名');
                }
            ),
            { numRuns: 100 }
        );
    });

    test('空字符串用户名应被拒绝', () => {
        const result = AuthManager.validateUsername('');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('请输入有效用户名');
    });

    test('null 和 undefined 用户名应被拒绝', () => {
        const nullResult = AuthManager.validateUsername(null);
        expect(nullResult.valid).toBe(false);
        expect(nullResult.error).toBe('请输入有效用户名');

        const undefinedResult = AuthManager.validateUsername(undefined);
        expect(undefinedResult.valid).toBe(false);
        expect(undefinedResult.error).toBe('请输入有效用户名');
    });

    test('包含非空白字符的用户名应被接受', () => {
        fc.assert(
            fc.property(
                // 生成至少包含一个非空白字符的字符串
                fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                (validUsername) => {
                    const result = AuthManager.validateUsername(validUsername);
                    
                    // 验证应该成功
                    expect(result.valid).toBe(true);
                    
                    // 不应该有错误信息
                    expect(result.error).toBeUndefined();
                }
            ),
            { numRuns: 100 }
        );
    });
});


/**
 * **Feature: user-auth-cloud-storage, Property 12: UI状态与登录状态一致**
 * 
 * *对于任意*登录状态，UI 应正确反映：已登录时显示用户名和登出按钮，未登录时显示登录和注册按钮。
 * 
 * **Validates: Requirements 6.1, 6.2**
 */
describe('Property 12: UI状态与登录状态一致', () => {
    // 模拟 DOM 元素
    let mockElements;
    
    beforeEach(() => {
        // 创建模拟 DOM 元素
        mockElements = {
            'user-logged-out': { style: { display: '' } },
            'user-logged-in': { style: { display: '' } },
            'display-username': { textContent: '' }
        };
        
        // 模拟 document.getElementById
        global.document = {
            getElementById: jest.fn((id) => mockElements[id] || null)
        };
    });
    
    afterEach(() => {
        delete global.document;
    });
    
    // 导入 AuthUI 模块
    const { AuthUI } = require('../app');
    
    test('对于任意已登录用户，UI应显示用户名和登出按钮', () => {
        fc.assert(
            fc.property(
                // 生成任意非空用户名
                fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                (username) => {
                    // 模拟已登录用户
                    const user = { username: username.trim() };
                    
                    // 调用 updateHeaderUserStatus
                    AuthUI.updateHeaderUserStatus(user);
                    
                    // 验证 UI 状态
                    // 已登录时：登出区域隐藏，登录区域显示
                    expect(mockElements['user-logged-out'].style.display).toBe('none');
                    expect(mockElements['user-logged-in'].style.display).toBe('flex');
                    expect(mockElements['display-username'].textContent).toBe(username.trim());
                }
            ),
            { numRuns: 100 }
        );
    });
    
    test('对于未登录状态（null用户），UI应显示登录和注册按钮', () => {
        // 调用 updateHeaderUserStatus 传入 null
        AuthUI.updateHeaderUserStatus(null);
        
        // 验证 UI 状态
        // 未登录时：登出区域显示，登录区域隐藏
        expect(mockElements['user-logged-out'].style.display).toBe('flex');
        expect(mockElements['user-logged-in'].style.display).toBe('none');
        expect(mockElements['display-username'].textContent).toBe('');
    });
    
    test('登录状态切换时UI应正确更新', () => {
        fc.assert(
            fc.property(
                // 生成任意非空用户名
                fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                (username) => {
                    const user = { username: username.trim() };
                    
                    // 初始状态：未登录
                    AuthUI.updateHeaderUserStatus(null);
                    expect(mockElements['user-logged-out'].style.display).toBe('flex');
                    expect(mockElements['user-logged-in'].style.display).toBe('none');
                    
                    // 登录后
                    AuthUI.updateHeaderUserStatus(user);
                    expect(mockElements['user-logged-out'].style.display).toBe('none');
                    expect(mockElements['user-logged-in'].style.display).toBe('flex');
                    expect(mockElements['display-username'].textContent).toBe(username.trim());
                    
                    // 登出后
                    AuthUI.updateHeaderUserStatus(null);
                    expect(mockElements['user-logged-out'].style.display).toBe('flex');
                    expect(mockElements['user-logged-in'].style.display).toBe('none');
                    expect(mockElements['display-username'].textContent).toBe('');
                }
            ),
            { numRuns: 100 }
        );
    });
});


/**
 * **Feature: user-auth-cloud-storage, Property 8: 登出清除会话和缓存**
 * 
 * *对于任意*已登录用户，执行登出操作后，token 应被清除，本地缓存的用户数据应被清除，用户应处于未登录状态。
 * 
 * **Validates: Requirements 3.1, 3.2**
 */
describe('Property 8: 登出清除会话和缓存', () => {
    // 导入需要的模块
    const { AuthManager, LocalCacheManager } = require('../app');
    
    // 定义 localStorage 键名常量（与 app.js 保持一致）
    const AUTH_TOKEN_KEY = 'sales_data_auth_token';
    const AUTH_USER_KEY = 'sales_data_auth_user';
    
    beforeEach(() => {
        // 清理状态
        localStorageMock.clear();
        AuthManager.token = null;
        AuthManager.currentUser = null;
    });
    
    test('对于任意已登录用户，登出后 token 应被清除', () => {
        fc.assert(
            fc.property(
                // 生成任意有效的用户名和 token
                fc.record({
                    username: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                    userId: fc.integer({ min: 1, max: 10000 }),
                    token: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length > 0)
                }),
                ({ username, userId, token }) => {
                    // 模拟已登录状态
                    AuthManager.token = token;
                    AuthManager.currentUser = { id: userId, username: username.trim() };
                    localStorageMock.setItem(AUTH_TOKEN_KEY, token);
                    localStorageMock.setItem(AUTH_USER_KEY, JSON.stringify({ id: userId, username: username.trim() }));
                    
                    // 验证登录状态
                    expect(AuthManager.isLoggedIn()).toBe(true);
                    expect(AuthManager.getToken()).toBe(token);
                    
                    // 执行登出
                    AuthManager.logout();
                    
                    // 验证 token 被清除
                    expect(AuthManager.token).toBeNull();
                    expect(AuthManager.getToken()).toBeNull();
                    expect(localStorageMock.getItem(AUTH_TOKEN_KEY)).toBeNull();
                }
            ),
            { numRuns: 100 }
        );
    });
    
    test('对于任意已登录用户，登出后用户信息应被清除', () => {
        fc.assert(
            fc.property(
                // 生成任意有效的用户信息
                fc.record({
                    username: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                    userId: fc.integer({ min: 1, max: 10000 }),
                    token: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length > 0)
                }),
                ({ username, userId, token }) => {
                    // 模拟已登录状态
                    AuthManager.token = token;
                    AuthManager.currentUser = { id: userId, username: username.trim() };
                    localStorageMock.setItem(AUTH_TOKEN_KEY, token);
                    localStorageMock.setItem(AUTH_USER_KEY, JSON.stringify({ id: userId, username: username.trim() }));
                    
                    // 验证登录状态
                    expect(AuthManager.getCurrentUser()).not.toBeNull();
                    expect(AuthManager.getCurrentUser().username).toBe(username.trim());
                    
                    // 执行登出
                    AuthManager.logout();
                    
                    // 验证用户信息被清除
                    expect(AuthManager.currentUser).toBeNull();
                    expect(AuthManager.getCurrentUser()).toBeNull();
                    expect(localStorageMock.getItem(AUTH_USER_KEY)).toBeNull();
                }
            ),
            { numRuns: 100 }
        );
    });
    
    test('对于任意已登录用户，登出后应处于未登录状态', () => {
        fc.assert(
            fc.property(
                // 生成任意有效的用户信息
                fc.record({
                    username: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                    userId: fc.integer({ min: 1, max: 10000 }),
                    token: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length > 0)
                }),
                ({ username, userId, token }) => {
                    // 模拟已登录状态
                    AuthManager.token = token;
                    AuthManager.currentUser = { id: userId, username: username.trim() };
                    
                    // 验证登录状态
                    expect(AuthManager.isLoggedIn()).toBe(true);
                    
                    // 执行登出
                    AuthManager.logout();
                    
                    // 验证处于未登录状态
                    expect(AuthManager.isLoggedIn()).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });
    
    test('对于任意已登录用户，登出后本地缓存数据应被清除', () => {
        fc.assert(
            fc.property(
                // 生成任意有效的用户信息和缓存数据
                fc.record({
                    username: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                    userId: fc.integer({ min: 1, max: 10000 }),
                    token: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length > 0),
                    cachedData: fc.array(
                        fc.record({
                            monthId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
                            monthName: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
                            importedAt: fc.date()
                        }),
                        { minLength: 1, maxLength: 5 }
                    )
                }),
                ({ username, userId, token, cachedData }) => {
                    // 模拟已登录状态
                    AuthManager.token = token;
                    AuthManager.currentUser = { id: userId, username: username.trim() };
                    
                    // 缓存用户数据
                    LocalCacheManager.cacheData(userId, cachedData);
                    
                    // 验证缓存数据存在
                    const cachedBefore = LocalCacheManager.getCachedData(userId);
                    expect(cachedBefore.length).toBe(cachedData.length);
                    
                    // 清除用户缓存（模拟登出时的操作）
                    LocalCacheManager.clearUserCache(userId);
                    
                    // 验证缓存数据被清除
                    const cachedAfter = LocalCacheManager.getCachedData(userId);
                    expect(cachedAfter.length).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });
    
    test('登出后 clearAllCache 应清除所有缓存和待同步操作', () => {
        fc.assert(
            fc.property(
                // 生成任意有效的用户信息
                fc.record({
                    userId: fc.integer({ min: 1, max: 10000 }),
                    pendingOps: fc.array(
                        fc.record({
                            type: fc.constantFrom('upload', 'delete'),
                            monthId: fc.string({ minLength: 1, maxLength: 20 }),
                            timestamp: fc.integer({ min: 0 })
                        }),
                        { minLength: 1, maxLength: 5 }
                    )
                }),
                ({ userId, pendingOps }) => {
                    // 先清理 localStorage
                    localStorageMock.clear();
                    
                    // 缓存用户数据
                    LocalCacheManager.cacheData(userId, [{ monthId: 'test', monthName: '测试', importedAt: new Date() }]);
                    
                    // 添加待同步操作
                    pendingOps.forEach(op => LocalCacheManager.addPendingOperation(op));
                    
                    // 验证数据存在
                    expect(LocalCacheManager.getCachedData(userId).length).toBeGreaterThan(0);
                    expect(LocalCacheManager.getPendingOperations().length).toBe(pendingOps.length);
                    
                    // 清除所有缓存
                    LocalCacheManager.clearAllCache();
                    
                    // 验证待同步操作被清除
                    expect(LocalCacheManager.getPendingOperations().length).toBe(0);
                    
                    // 验证用户缓存被清除（通过检查 localStorage 中以 CACHE_KEY_PREFIX 开头的键）
                    const cacheKey = 'sales_data_cache_' + userId;
                    expect(localStorageMock.getItem(cacheKey)).toBeNull();
                }
            ),
            { numRuns: 100 }
        );
    });
});
