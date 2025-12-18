/**
 * CloudSyncManager 和 LocalCacheManager 属性测试
 * 
 * 测试云端数据同步功能
 */

const fc = require('fast-check');
const { initDatabase, closeDatabase, query, run } = require('./db');
const { hashPassword } = require('./utils/password');
const { generateToken } = require('./utils/jwt');

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
global.navigator = { onLine: true };
global.window = {
    dispatchEvent: jest.fn(),
    addEventListener: jest.fn()
};
global.CustomEvent = class CustomEvent {
    constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
    }
};

// 导入被测模块
const { AuthManager, CloudSyncManager, LocalCacheManager } = require('../app');

// 测试前初始化数据库
beforeAll(async () => {
    await initDatabase();
});

// 每个测试后清理数据
beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    AuthManager.token = null;
    AuthManager.currentUser = null;
    CloudSyncManager.syncStatus = 'idle';
    CloudSyncManager.lastSyncTime = null;
    global.navigator.onLine = true;
});

afterEach(() => {
    run('DELETE FROM sales_data');
    run('DELETE FROM users');
});

// 测试后关闭数据库
afterAll(() => {
    closeDatabase();
});

/**
 * 辅助函数：创建测试用户并返回用户信息和 token
 */
async function createTestUser(username = 'testuser') {
    const password = 'password123';
    const passwordHash = await hashPassword(password);
    run(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        [username, passwordHash]
    );
    const user = query('SELECT id FROM users WHERE username = ?', [username]);
    const userId = user[0].id;
    const token = generateToken({ id: userId, username });
    return { userId, username, token };
}

/**
 * 辅助函数：模拟登录用户
 */
function simulateLogin(userId, username, token) {
    AuthManager.token = token;
    AuthManager.currentUser = { id: userId, username };
}

/**
 * 辅助函数：直接插入销售数据到数据库
 */
function insertSalesData(userId, monthData) {
    const { monthId, monthName, color, config, groupedData, rawData } = monthData;
    run(
        `INSERT INTO sales_data (user_id, month_id, month_name, color, config, grouped_data, raw_data) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            userId, 
            monthId, 
            monthName, 
            color || '#4A90A4', 
            JSON.stringify(config || {}), 
            JSON.stringify(groupedData || []), 
            JSON.stringify(rawData || [])
        ]
    );
    const inserted = query('SELECT id FROM sales_data WHERE user_id = ? AND month_id = ?', [userId, monthId]);
    return inserted[0].id;
}

/**
 * 辅助函数：获取用户的所有销售数据
 */
function getUserSalesData(userId) {
    return query(
        `SELECT id, month_id, month_name, color, config, grouped_data, raw_data 
         FROM sales_data WHERE user_id = ? ORDER BY created_at DESC`,
        [userId]
    ).map(item => ({
        id: item.id,
        monthId: item.month_id,
        monthName: item.month_name,
        color: item.color,
        config: JSON.parse(item.config || '{}'),
        groupedData: JSON.parse(item.grouped_data || '[]'),
        rawData: JSON.parse(item.raw_data || '[]')
    }));
}

/**
 * 生成有效的月度数据
 */
const monthDataArbitrary = fc.record({
    monthId: fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => s.trim().length > 0)
        .map(s => s.replace(/['"\\;]/g, 'x')),
    monthName: fc.string({ minLength: 1, maxLength: 50 })
        .filter(s => s.trim().length > 0)
        .map(s => s.replace(/['"\\;]/g, 'x')),
    color: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => '#' + s),
    config: fc.record({
        categoryColumn: fc.string({ minLength: 1, maxLength: 20 }),
        productColumn: fc.string({ minLength: 1, maxLength: 20 })
    }),
    groupedData: fc.array(
        fc.record({
            category: fc.string({ minLength: 1, maxLength: 30 }),
            product: fc.string({ minLength: 1, maxLength: 30 }),
            quantity: fc.integer({ min: 0, max: 10000 }),
            amount: fc.double({ min: 0, max: 100000, noNaN: true, noDefaultInfinity: true })
        }),
        { minLength: 0, maxLength: 5 }
    ),
    rawData: fc.array(
        fc.dictionary(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.oneof(
                fc.string(), 
                fc.integer(),
                fc.double({ noNaN: true, noDefaultInfinity: true })
            )
        ),
        { minLength: 0, maxLength: 5 }
    )
});

/**
 * **Feature: user-auth-cloud-storage, Property 7: 登录后数据加载**
 * 
 * *对于任意*已登录用户，如果该用户在云端有销售数据，登录后应能获取到所有该用户的数据。
 * 
 * **Validates: Requirements 2.3, 4.4**
 */
describe('Property 7: 登录后数据加载', () => {
    test('登录后可以获取用户在云端的所有数据', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(monthDataArbitrary, { minLength: 1, maxLength: 5 })
                    .map(arr => {
                        // 确保每个月份ID唯一
                        const seen = new Set();
                        return arr.filter(item => {
                            if (seen.has(item.monthId)) return false;
                            seen.add(item.monthId);
                            return true;
                        });
                    })
                    .filter(arr => arr.length > 0),
                async (monthDataArray) => {
                    // 清理之前的数据
                    run('DELETE FROM sales_data');
                    run('DELETE FROM users');
                    localStorageMock.clear();
                    
                    // 创建测试用户
                    const { userId, username, token } = await createTestUser();
                    
                    // 在数据库中插入用户的销售数据（模拟云端已有数据）
                    for (const monthData of monthDataArray) {
                        insertSalesData(userId, monthData);
                    }
                    
                    // 模拟用户登录
                    simulateLogin(userId, username, token);
                    
                    // 模拟 fetch 返回云端数据
                    const cloudData = getUserSalesData(userId);
                    global.fetch.mockResolvedValueOnce({
                        ok: true,
                        json: async () => ({ success: true, data: cloudData })
                    });
                    
                    // 调用 downloadAllData
                    const result = await CloudSyncManager.downloadAllData();
                    
                    // 应该成功获取数据
                    expect(result.success).toBe(true);
                    expect(result.data).toBeDefined();
                    expect(result.data.length).toBe(monthDataArray.length);
                    
                    // 验证每条数据都存在
                    for (const monthData of monthDataArray) {
                        const found = result.data.find(d => d.monthId === monthData.monthId);
                        expect(found).toBeDefined();
                        expect(found.monthName).toBe(monthData.monthName);
                    }
                }
            ),
            { numRuns: 30 }
        );
    }, 60000);

    test('用户没有云端数据时返回空数组', async () => {
        // 清理数据
        run('DELETE FROM sales_data');
        run('DELETE FROM users');
        localStorageMock.clear();
        
        // 创建测试用户
        const { userId, username, token } = await createTestUser();
        
        // 模拟用户登录
        simulateLogin(userId, username, token);
        
        // 模拟 fetch 返回空数据
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, data: [] })
        });
        
        // 调用 downloadAllData
        const result = await CloudSyncManager.downloadAllData();
        
        // 应该成功但数据为空
        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
    });

    test('未登录时无法获取数据', async () => {
        // 确保未登录状态
        AuthManager.token = null;
        AuthManager.currentUser = null;
        
        // 调用 downloadAllData
        const result = await CloudSyncManager.downloadAllData();
        
        // 应该返回错误
        expect(result.success).toBe(false);
        expect(result.error).toBe('请先登录');
    });
});

/**
 * **Feature: user-auth-cloud-storage, Property 11: 云端数据优先**
 * 
 * *对于任意*本地数据与云端数据不一致的情况，同步后本地数据应与云端数据一致。
 * 
 * **Validates: Requirements 4.5**
 */
describe('Property 11: 云端数据优先', () => {
    test('下载云端数据后本地缓存与云端一致', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(monthDataArbitrary, { minLength: 1, maxLength: 5 })
                    .map(arr => {
                        const seen = new Set();
                        return arr.filter(item => {
                            if (seen.has(item.monthId)) return false;
                            seen.add(item.monthId);
                            return true;
                        });
                    })
                    .filter(arr => arr.length > 0),
                async (cloudDataArray) => {
                    // 清理之前的数据
                    run('DELETE FROM sales_data');
                    run('DELETE FROM users');
                    localStorageMock.clear();
                    
                    // 创建测试用户
                    const { userId, username, token } = await createTestUser();
                    
                    // 模拟用户登录
                    simulateLogin(userId, username, token);
                    
                    // 在本地缓存中放入不同的数据（模拟本地有旧数据）
                    const oldLocalData = [{ monthId: 'old_local', monthName: '旧本地数据' }];
                    LocalCacheManager.cacheData(userId, oldLocalData);
                    
                    // 在数据库中插入云端数据
                    for (const monthData of cloudDataArray) {
                        insertSalesData(userId, monthData);
                    }
                    
                    // 获取云端数据
                    const cloudData = getUserSalesData(userId);
                    
                    // 模拟 fetch 返回云端数据
                    global.fetch.mockResolvedValueOnce({
                        ok: true,
                        json: async () => ({ success: true, data: cloudData })
                    });
                    
                    // 调用 downloadAllData
                    const result = await CloudSyncManager.downloadAllData();
                    
                    // 应该成功
                    expect(result.success).toBe(true);
                    
                    // 获取本地缓存
                    const localCachedData = LocalCacheManager.getCachedData(userId);
                    
                    // 本地缓存应该与云端数据一致
                    expect(localCachedData.length).toBe(cloudDataArray.length);
                    
                    // 验证每条云端数据都在本地缓存中
                    for (const cloudItem of cloudData) {
                        const localItem = localCachedData.find(d => d.monthId === cloudItem.monthId);
                        expect(localItem).toBeDefined();
                        expect(localItem.monthName).toBe(cloudItem.monthName);
                    }
                    
                    // 旧的本地数据应该被覆盖（不应存在）
                    const oldDataFound = localCachedData.find(d => d.monthId === 'old_local');
                    expect(oldDataFound).toBeUndefined();
                }
            ),
            { numRuns: 30 }
        );
    }, 60000);

    test('网络离线时返回本地缓存数据', async () => {
        // 清理数据
        run('DELETE FROM sales_data');
        run('DELETE FROM users');
        localStorageMock.clear();
        
        // 创建测试用户
        const { userId, username, token } = await createTestUser();
        
        // 模拟用户登录
        simulateLogin(userId, username, token);
        
        // 在本地缓存中放入数据
        const cachedData = [
            { monthId: 'cached1', monthName: '缓存数据1', importedAt: new Date() },
            { monthId: 'cached2', monthName: '缓存数据2', importedAt: new Date() }
        ];
        LocalCacheManager.cacheData(userId, cachedData);
        
        // 模拟网络离线
        global.navigator.onLine = false;
        
        // 调用 downloadAllData
        const result = await CloudSyncManager.downloadAllData();
        
        // 应该返回本地缓存数据
        expect(result.success).toBe(true);
        expect(result.data.length).toBe(2);
        expect(result.data[0].monthId).toBe('cached1');
        expect(result.data[1].monthId).toBe('cached2');
        
        // 同步状态应该是 offline
        expect(CloudSyncManager.getSyncStatus()).toBe('offline');
    });

    test('网络离线且无本地缓存时返回错误', async () => {
        // 清理数据
        localStorageMock.clear();
        
        // 创建测试用户
        const { userId, username, token } = await createTestUser();
        
        // 模拟用户登录
        simulateLogin(userId, username, token);
        
        // 模拟网络离线
        global.navigator.onLine = false;
        
        // 调用 downloadAllData
        const result = await CloudSyncManager.downloadAllData();
        
        // 应该返回错误
        expect(result.success).toBe(false);
        expect(result.error).toBe('网络离线，无本地缓存数据');
    });
});

/**
 * LocalCacheManager 单元测试
 */
describe('LocalCacheManager 基本功能', () => {
    test('缓存和获取数据', () => {
        const userId = 123;
        const testData = [
            { monthId: 'test1', monthName: '测试1', importedAt: new Date() },
            { monthId: 'test2', monthName: '测试2', importedAt: new Date() }
        ];
        
        LocalCacheManager.cacheData(userId, testData);
        const retrieved = LocalCacheManager.getCachedData(userId);
        
        expect(retrieved.length).toBe(2);
        expect(retrieved[0].monthId).toBe('test1');
        expect(retrieved[1].monthId).toBe('test2');
    });

    test('待同步操作队列', () => {
        const op1 = { type: 'upload', data: { monthId: 'op1' }, timestamp: Date.now() };
        const op2 = { type: 'delete', monthId: 'op2', timestamp: Date.now() };
        
        LocalCacheManager.addPendingOperation(op1);
        LocalCacheManager.addPendingOperation(op2);
        
        const pending = LocalCacheManager.getPendingOperations();
        expect(pending.length).toBe(2);
        expect(pending[0].type).toBe('upload');
        expect(pending[1].type).toBe('delete');
        
        LocalCacheManager.clearPendingOperations();
        expect(LocalCacheManager.getPendingOperations().length).toBe(0);
    });

    test('清除用户缓存', () => {
        const userId = 456;
        const testData = [{ monthId: 'test', monthName: '测试' }];
        
        LocalCacheManager.cacheData(userId, testData);
        expect(LocalCacheManager.getCachedData(userId).length).toBe(1);
        
        LocalCacheManager.clearUserCache(userId);
        expect(LocalCacheManager.getCachedData(userId).length).toBe(0);
    });
});
