const fc = require('fast-check');
const { initDatabase, closeDatabase, query, run } = require('../db');
const { hashPassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');

// 测试前初始化数据库
beforeAll(async () => {
    await initDatabase();
});

// 每个测试后清理数据
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
    // 查询刚插入的用户ID
    const user = query('SELECT id FROM users WHERE username = ?', [username]);
    const userId = user[0].id;
    const token = generateToken({ id: userId, username });
    return { userId, username, token };
}

/**
 * 辅助函数：模拟上传数据
 */
function simulateUploadData(userId, monthData) {
    const { monthId, monthName, color, config, groupedData, rawData } = monthData;
    
    // 验证必填字段
    if (!monthId || typeof monthId !== 'string') {
        return { success: false, error: '月份ID不能为空' };
    }
    
    if (!monthName || typeof monthName !== 'string') {
        return { success: false, error: '月份名称不能为空' };
    }
    
    // 检查是否已存在相同月份的数据
    const existingData = query(
        'SELECT id FROM sales_data WHERE user_id = ? AND month_id = ?',
        [userId, monthId]
    );

    const configJson = JSON.stringify(config || {});
    const groupedDataJson = JSON.stringify(groupedData || []);
    const rawDataJson = JSON.stringify(rawData || []);
    const colorValue = color || '#4A90A4';
    
    let resultId;
    
    if (existingData.length > 0) {
        // 更新现有数据
        run(
            `UPDATE sales_data 
             SET month_name = ?, color = ?, config = ?, grouped_data = ?, raw_data = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [monthName, colorValue, configJson, groupedDataJson, rawDataJson, existingData[0].id]
        );
        resultId = existingData[0].id;
    } else {
        // 插入新数据
        run(
            `INSERT INTO sales_data (user_id, month_id, month_name, color, config, grouped_data, raw_data) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, monthId, monthName, colorValue, configJson, groupedDataJson, rawDataJson]
        );
        // 查询刚插入的数据ID
        const inserted = query(
            'SELECT id FROM sales_data WHERE user_id = ? AND month_id = ?',
            [userId, monthId]
        );
        resultId = inserted[0].id;
    }
    
    return { success: true, id: resultId };
}

/**
 * 辅助函数：模拟获取用户数据
 */
function simulateGetData(userId) {
    const salesData = query(
        `SELECT id, month_id, month_name, color, config, grouped_data, raw_data, created_at, updated_at 
         FROM sales_data 
         WHERE user_id = ? 
         ORDER BY created_at DESC`,
        [userId]
    );
    
    return salesData.map(item => ({
        id: item.id,
        monthId: item.month_id,
        monthName: item.month_name,
        color: item.color,
        config: JSON.parse(item.config || '{}'),
        groupedData: JSON.parse(item.grouped_data || '[]'),
        rawData: JSON.parse(item.raw_data || '[]'),
        createdAt: item.created_at,
        updatedAt: item.updated_at
    }));
}

/**
 * 辅助函数：模拟删除数据
 */
function simulateDeleteData(userId, dataId) {
    // 检查数据是否存在且属于当前用户
    const existingData = query(
        'SELECT id FROM sales_data WHERE id = ? AND user_id = ?',
        [dataId, userId]
    );
    
    if (existingData.length === 0) {
        return { success: false, error: '数据不存在或无权限删除' };
    }
    
    // 删除数据
    run('DELETE FROM sales_data WHERE id = ?', [dataId]);
    
    return { success: true };
}

/**
 * 生成有效的月度数据
 * 注意：JSON.stringify 会将 NaN 转换为 null，所以我们需要避免生成 NaN
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
            // 使用 double 并过滤掉 NaN 和 Infinity
            amount: fc.double({ min: 0, max: 100000, noNaN: true, noDefaultInfinity: true })
        }),
        { minLength: 0, maxLength: 10 }
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
        { minLength: 0, maxLength: 10 }
    )
});


/**
 * **Feature: user-auth-cloud-storage, Property 9: 数据上传同步**
 * 
 * *对于任意*已登录用户上传的月度销售数据，上传成功后从云端查询应能获取到相同的数据。
 * 
 * **Validates: Requirements 4.1**
 */
describe('Property 9: 数据上传同步', () => {
    test('上传数据后可以查询到相同数据', async () => {
        await fc.assert(
            fc.asyncProperty(
                monthDataArbitrary,
                async (monthData) => {
                    // 清理之前的数据
                    run('DELETE FROM sales_data');
                    run('DELETE FROM users');
                    
                    // 创建测试用户
                    const { userId } = await createTestUser();
                    
                    // 上传数据
                    const uploadResult = simulateUploadData(userId, monthData);
                    
                    // 上传应该成功
                    expect(uploadResult.success).toBe(true);
                    expect(uploadResult.id).toBeDefined();
                    
                    // 查询数据
                    const retrievedData = simulateGetData(userId);
                    
                    // 应该能查询到数据
                    expect(retrievedData.length).toBe(1);
                    
                    const retrieved = retrievedData[0];
                    
                    // 验证数据一致性
                    expect(retrieved.monthId).toBe(monthData.monthId);
                    expect(retrieved.monthName).toBe(monthData.monthName);
                    expect(retrieved.color).toBe(monthData.color);
                    expect(retrieved.config).toEqual(monthData.config);
                    expect(retrieved.groupedData).toEqual(monthData.groupedData);
                    expect(retrieved.rawData).toEqual(monthData.rawData);
                }
            ),
            { numRuns: 50 }
        );
    }, 60000);
    
    test('多次上传不同月份数据都可以查询到', async () => {
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
                    
                    // 创建测试用户
                    const { userId } = await createTestUser();
                    
                    // 上传所有数据
                    for (const monthData of monthDataArray) {
                        const uploadResult = simulateUploadData(userId, monthData);
                        expect(uploadResult.success).toBe(true);
                    }
                    
                    // 查询数据
                    const retrievedData = simulateGetData(userId);
                    
                    // 应该能查询到所有数据
                    expect(retrievedData.length).toBe(monthDataArray.length);
                    
                    // 验证每条数据都存在
                    for (const monthData of monthDataArray) {
                        const found = retrievedData.find(d => d.monthId === monthData.monthId);
                        expect(found).toBeDefined();
                        expect(found.monthName).toBe(monthData.monthName);
                    }
                }
            ),
            { numRuns: 30 }
        );
    }, 60000);
});


/**
 * **Feature: user-auth-cloud-storage, Property 10: 数据删除同步**
 * 
 * *对于任意*已登录用户删除的月度销售数据，删除成功后从云端查询应不再包含该数据。
 * 
 * **Validates: Requirements 4.2**
 */
describe('Property 10: 数据删除同步', () => {
    test('删除数据后查询不到该数据', async () => {
        await fc.assert(
            fc.asyncProperty(
                monthDataArbitrary,
                async (monthData) => {
                    // 清理之前的数据
                    run('DELETE FROM sales_data');
                    run('DELETE FROM users');
                    
                    // 创建测试用户
                    const { userId } = await createTestUser();
                    
                    // 先上传数据
                    const uploadResult = simulateUploadData(userId, monthData);
                    expect(uploadResult.success).toBe(true);
                    
                    const dataId = uploadResult.id;
                    
                    // 确认数据存在
                    let retrievedData = simulateGetData(userId);
                    expect(retrievedData.length).toBe(1);
                    expect(retrievedData[0].id).toBe(dataId);
                    
                    // 删除数据
                    const deleteResult = simulateDeleteData(userId, dataId);
                    expect(deleteResult.success).toBe(true);
                    
                    // 查询数据，应该为空
                    retrievedData = simulateGetData(userId);
                    expect(retrievedData.length).toBe(0);
                    
                    // 确认该数据ID不存在
                    const found = retrievedData.find(d => d.id === dataId);
                    expect(found).toBeUndefined();
                }
            ),
            { numRuns: 50 }
        );
    }, 60000);
    
    test('删除一条数据不影响其他数据', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(monthDataArbitrary, { minLength: 2, maxLength: 5 })
                    .map(arr => {
                        // 确保每个月份ID唯一
                        const seen = new Set();
                        return arr.filter(item => {
                            if (seen.has(item.monthId)) return false;
                            seen.add(item.monthId);
                            return true;
                        });
                    })
                    .filter(arr => arr.length >= 2),
                fc.nat(),
                async (monthDataArray, deleteIndex) => {
                    // 清理之前的数据
                    run('DELETE FROM sales_data');
                    run('DELETE FROM users');
                    
                    // 创建测试用户
                    const { userId } = await createTestUser();
                    
                    // 上传所有数据
                    const uploadedIds = [];
                    for (const monthData of monthDataArray) {
                        const uploadResult = simulateUploadData(userId, monthData);
                        expect(uploadResult.success).toBe(true);
                        uploadedIds.push(uploadResult.id);
                    }
                    
                    // 选择要删除的数据索引
                    const indexToDelete = deleteIndex % monthDataArray.length;
                    const idToDelete = uploadedIds[indexToDelete];
                    const monthIdToDelete = monthDataArray[indexToDelete].monthId;
                    
                    // 删除数据
                    const deleteResult = simulateDeleteData(userId, idToDelete);
                    expect(deleteResult.success).toBe(true);
                    
                    // 查询数据
                    const retrievedData = simulateGetData(userId);
                    
                    // 应该少一条数据
                    expect(retrievedData.length).toBe(monthDataArray.length - 1);
                    
                    // 被删除的数据不应存在
                    const deletedFound = retrievedData.find(d => d.monthId === monthIdToDelete);
                    expect(deletedFound).toBeUndefined();
                    
                    // 其他数据应该都存在
                    for (let i = 0; i < monthDataArray.length; i++) {
                        if (i === indexToDelete) continue;
                        const found = retrievedData.find(d => d.monthId === monthDataArray[i].monthId);
                        expect(found).toBeDefined();
                    }
                }
            ),
            { numRuns: 30 }
        );
    }, 60000);
    
    test('删除不存在的数据返回错误', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1000, max: 9999 }),
                async (nonExistentId) => {
                    // 清理之前的数据
                    run('DELETE FROM sales_data');
                    run('DELETE FROM users');
                    
                    // 创建测试用户
                    const { userId } = await createTestUser();
                    
                    // 尝试删除不存在的数据
                    const deleteResult = simulateDeleteData(userId, nonExistentId);
                    
                    // 应该返回错误
                    expect(deleteResult.success).toBe(false);
                    expect(deleteResult.error).toBe('数据不存在或无权限删除');
                }
            ),
            { numRuns: 50 }
        );
    }, 30000);
    
    test('用户不能删除其他用户的数据', async () => {
        await fc.assert(
            fc.asyncProperty(
                monthDataArbitrary,
                async (monthData) => {
                    // 清理之前的数据
                    run('DELETE FROM sales_data');
                    run('DELETE FROM users');
                    
                    // 创建两个测试用户
                    const user1 = await createTestUser('user1');
                    const user2 = await createTestUser('user2');
                    
                    // 用户1上传数据
                    const uploadResult = simulateUploadData(user1.userId, monthData);
                    expect(uploadResult.success).toBe(true);
                    
                    const dataId = uploadResult.id;
                    
                    // 用户2尝试删除用户1的数据
                    const deleteResult = simulateDeleteData(user2.userId, dataId);
                    
                    // 应该返回错误
                    expect(deleteResult.success).toBe(false);
                    expect(deleteResult.error).toBe('数据不存在或无权限删除');
                    
                    // 用户1的数据应该仍然存在
                    const user1Data = simulateGetData(user1.userId);
                    expect(user1Data.length).toBe(1);
                    expect(user1Data[0].id).toBe(dataId);
                }
            ),
            { numRuns: 30 }
        );
    }, 60000);
});
