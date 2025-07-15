// 加密/解密模块
// 使用Node.js crypto模块进行数据加密

const crypto = require('crypto');

class CryptoService {
    constructor(encryptionKey) {
        // 确保密钥长度为32字节
        this.key = Buffer.from((encryptionKey || '').padEnd(32, '0').slice(0, 32));
        this.algorithm = 'aes-256-cbc';
        this.ivLength = 16;
    }

    // 加密函数
    encrypt(text) {
        try {
            const iv = crypto.randomBytes(this.ivLength);
            const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            // 返回iv:密文
            return iv.toString('hex') + ':' + encrypted;
        } catch (error) {
            console.error('加密失败:', error.message);
            throw new Error('数据加密失败');
        }
    }

    // 解密函数
    decrypt(encryptedText) {
        try {
            const [ivHex, encrypted] = encryptedText.split(':');
            const iv = Buffer.from(ivHex, 'hex');
            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            console.error('解密失败:', error.message);
            throw new Error('数据解密失败');
        }
    }

    // 生成随机密钥
    static generateKey() {
        return crypto.randomBytes(32).toString('hex');
    }
}

module.exports = CryptoService; 