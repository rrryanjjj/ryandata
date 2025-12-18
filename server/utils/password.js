const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

/**
 * 对密码进行哈希处理
 * @param {string} password - 明文密码
 * @returns {Promise<string>} - 哈希后的密码
 */
async function hashPassword(password) {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 验证密码是否匹配
 * @param {string} password - 明文密码
 * @param {string} hash - 哈希后的密码
 * @returns {Promise<boolean>} - 是否匹配
 */
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

module.exports = {
    hashPassword,
    verifyPassword,
    SALT_ROUNDS
};
