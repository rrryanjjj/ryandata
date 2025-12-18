const fc = require('fast-check');
const jwt = require('jsonwebtoken');
const { generateToken, verifyToken, JWT_SECRET, TOKEN_EXPIRY_SECONDS } = require('./jwt');

/**
 * **Feature: user-auth-cloud-storage, Property 14: Token 过期时间设置**
 * 
 * *对于任意*生成的 Session_Token，解析后的过期时间应为7天后。
 * 
 * **Validates: Requirements 7.3**
 */
describe('Property 14: Token 过期时间设置', () => {
    test('生成的 Token 过期时间应为7天后', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    id: fc.integer({ min: 1, max: 1000000 }),
                    username: fc.string({ minLength: 1, maxLength: 50 })
                        .filter(s => s.trim().length > 0)
                }),
                async (payload) => {
                    const beforeGenerate = Math.floor(Date.now() / 1000);
                    const token = generateToken(payload);
                    const afterGenerate = Math.floor(Date.now() / 1000);
                    
                    // 解码 token 获取过期时间
                    const decoded = jwt.decode(token);
                    
                    // Token 应该包含 exp 字段
                    expect(decoded).toHaveProperty('exp');
                    expect(decoded).toHaveProperty('iat');
                    
                    // 过期时间应该是签发时间 + 7天
                    const expectedExpMin = beforeGenerate + TOKEN_EXPIRY_SECONDS;
                    const expectedExpMax = afterGenerate + TOKEN_EXPIRY_SECONDS;
                    
                    expect(decoded.exp).toBeGreaterThanOrEqual(expectedExpMin);
                    expect(decoded.exp).toBeLessThanOrEqual(expectedExpMax);
                    
                    // 验证 token 应该成功
                    const result = verifyToken(token);
                    expect(result.valid).toBe(true);
                    expect(result.payload.id).toBe(payload.id);
                    expect(result.payload.username).toBe(payload.username);
                }
            ),
            { numRuns: 100 }
        );
    });
});
