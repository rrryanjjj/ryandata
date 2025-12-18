const fc = require('fast-check');
const { hashPassword, verifyPassword } = require('./password');

/**
 * **Feature: user-auth-cloud-storage, Property 13: 密码哈希存储**
 * 
 * *对于任意*注册的用户，数据库中存储的密码应是哈希值而非明文，且哈希值与原密码不相等。
 * 
 * **Validates: Requirements 7.1, 7.2**
 */
describe('Property 13: 密码哈希存储', () => {
    test('哈希值与原密码不相等，且可以正确验证', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 6, maxLength: 50 }),
                async (password) => {
                    const hash = await hashPassword(password);
                    
                    // 哈希值与原密码不相等
                    expect(hash).not.toBe(password);
                    
                    // 哈希值长度应该是 bcrypt 标准长度 (60 字符)
                    expect(hash.length).toBe(60);
                    
                    // 哈希值应该以 $2a$ 或 $2b$ 开头 (bcrypt 标识)
                    expect(hash).toMatch(/^\$2[ab]\$/);
                    
                    // 使用正确密码验证应该成功
                    const isValid = await verifyPassword(password, hash);
                    expect(isValid).toBe(true);
                    
                    // 使用错误密码验证应该失败
                    const wrongPassword = password + 'wrong';
                    const isInvalid = await verifyPassword(wrongPassword, hash);
                    expect(isInvalid).toBe(false);
                }
            ),
            { numRuns: 20 } // 减少运行次数，因为密码哈希较慢
        );
    }, 60000); // 增加超时时间到60秒
});
