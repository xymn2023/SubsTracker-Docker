// 核心业务逻辑模块
// 处理配置创建和消息发送的业务逻辑

const { v4: uuidv4 } = require('uuid');
const Database = require('../core/database');
const CryptoService = require('../core/crypto');
const WeChatService = require('../core/wechat');
const WeChatCallbackCrypto = require('../core/wechat-callback');
const path = require('path');

// 环境变量
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../database/notifier.db');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-for-development-only';

const db = new Database(DB_PATH);
const crypto = new CryptoService(ENCRYPTION_KEY);
const wechat = new WeChatService();

// 初始化数据库（仅需调用一次）
db.init().catch(console.error);

/**
 * 创建回调配置（第一步）
 * @param {Object} config - { corpid, callback_token, encoding_aes_key }
 * @returns {Promise<{ code: string, callbackUrl: string }>}
 */
async function createCallbackConfiguration(config) {
    const { corpid, callback_token, encoding_aes_key } = config;
    if (!corpid || !callback_token || !encoding_aes_key) {
        throw new Error('回调配置参数不完整');
    }
    if (encoding_aes_key.length !== 43) {
        throw new Error('EncodingAESKey必须是43位字符');
    }

    // 检查是否已存在相同的回调配置
    const existingConfig = await db.getCallbackConfiguration(corpid, callback_token);
    if (existingConfig) {
        console.log('发现重复回调配置，更新现有配置，code:', existingConfig.code);

        // 加密新的encoding_aes_key
        const encrypted_encoding_aes_key = crypto.encrypt(encoding_aes_key);

        // 更新现有的回调配置
        await db.updateCallbackConfiguration({
            code: existingConfig.code,
            corpid,
            callback_token,
            encrypted_encoding_aes_key
        });

        return {
            code: existingConfig.code,
            callbackUrl: `/api/callback/${existingConfig.code}`,
            message: '回调配置已更新'
        };
    }

    // 生成唯一code
    const code = uuidv4();
    // 加密encoding_aes_key
    const encrypted_encoding_aes_key = crypto.encrypt(encoding_aes_key);

    // 保存回调配置到数据库
    await db.saveCallbackConfiguration({
        code,
        corpid,
        callback_token,
        encrypted_encoding_aes_key
    });

    console.log('回调配置创建成功，code:', code);

    return {
        code,
        callbackUrl: `/api/callback/${code}`
    };
}

/**
 * 完善配置（第二步）
 * @param {Object} config - { code, corpsecret, agentid, touser, description }
 * @returns {Promise<{ code: string, apiUrl: string, callbackUrl: string }>}
 */
async function completeConfiguration(config) {
    const { code, corpsecret, agentid, touser, description } = config;
    if (!code || !corpsecret || !agentid || !touser) {
        throw new Error('参数不完整');
    }

    // 检查回调配置是否存在
    const callbackConfig = await db.getConfigurationByCode(code);
    if (!callbackConfig) {
        throw new Error('回调配置不存在，请先生成回调URL');
    }

    // 加密corpsecret
    const encrypted_corpsecret = crypto.encrypt(corpsecret);
    const formattedTouser = Array.isArray(touser) ? touser.join('|') : touser;

    // 更新配置
    await db.completeConfiguration({
        code,
        encrypted_corpsecret,
        agentid,
        touser: formattedTouser,
        description: description || ''
    });

    console.log('配置完善成功，code:', code);

    return {
        code,
        apiUrl: `/api/notify/${code}`,
        callbackUrl: `/api/callback/${code}`
    };
}

/**
 * 创建配置（原有方法，保持兼容性）
 * @param {Object} config - { corpid, corpsecret, agentid, touser, description, callback_token, encoding_aes_key, callback_enabled }
 * @returns {Promise<{ code: string, apiUrl: string, callbackUrl?: string }>}
 */
async function createConfiguration(config) {
    const {
        corpid, corpsecret, agentid, touser, description,
        callback_token, encoding_aes_key, callback_enabled
    } = config;
    if (!corpid || !corpsecret || !agentid || !touser) {
        throw new Error('参数不完整');
    }

    // 第一步：优先处理回调配置验证
    if (callback_enabled) {
        if (!callback_token || !encoding_aes_key) {
            throw new Error('启用回调时必须提供回调Token和EncodingAESKey');
        }
        if (encoding_aes_key.length !== 43) {
            throw new Error('EncodingAESKey必须是43位字符');
        }
        console.log('回调配置验证通过，继续处理配置...');
    }

    // 第二步：检查是否已存在完全相同的配置（包括回调配置）
    const formattedTouser = Array.isArray(touser) ? touser.join('|') : touser;
    const existingConfig = await db.getConfigurationByCompleteFields(
        corpid,
        agentid,
        formattedTouser,
        callback_enabled ? 1 : 0,
        callback_token || null
    );

    if (existingConfig) {
        console.log('发现重复配置，更新现有配置，code:', existingConfig.code);

        // 加密新的corpsecret
        const encrypted_corpsecret = crypto.encrypt(corpsecret);
        // 加密新的encoding_aes_key（如果提供）
        const encrypted_encoding_aes_key = encoding_aes_key ? crypto.encrypt(encoding_aes_key) : null;

        // 更新现有配置
        await db.updateConfiguration({
            code: existingConfig.code,
            corpid,
            encrypted_corpsecret,
            agentid,
            touser: formattedTouser,
            description: description || '',
            callback_token: callback_token || null,
            encrypted_encoding_aes_key,
            callback_enabled: callback_enabled ? 1 : 0
        });

        const result = {
            code: existingConfig.code,
            apiUrl: `/api/notify/${existingConfig.code}`,
            message: '配置已更新'
        };
        if (callback_enabled) {
            result.callbackUrl = `/api/callback/${existingConfig.code}`;
        }
        return result;
    }

    // 第三步：生成新配置
    const code = uuidv4();
    // 加密corpsecret
    const encrypted_corpsecret = crypto.encrypt(corpsecret);
    // 加密encoding_aes_key（如果提供）
    const encrypted_encoding_aes_key = encoding_aes_key ? crypto.encrypt(encoding_aes_key) : null;

    // 保存到数据库
    await db.saveConfiguration({
        code,
        corpid,
        encrypted_corpsecret,
        agentid,
        touser: formattedTouser,
        description: description || '',
        callback_token: callback_token || null,
        encrypted_encoding_aes_key,
        callback_enabled: callback_enabled ? 1 : 0
    });

    console.log('新配置创建成功，code:', code);

    // 返回API调用信息
    const result = {
        code,
        apiUrl: `/api/notify/${code}`
    };
    if (callback_enabled) {
        result.callbackUrl = `/api/callback/${code}`;
    }
    return result;
}

/**
 * 发送通知
 * @param {string} code - 唯一配置code
 * @param {string} title - 消息标题
 * @param {string} content - 消息内容
 * @returns {Promise<Object>} - 企业微信API返回结果
 */
async function sendNotification(code, title, content) {
    // 查询配置
    const config = await db.getConfigurationByCode(code);
    if (!config) {
        throw new Error('无效的code，未找到配置');
    }
    // 解密corpsecret
    const corpsecret = crypto.decrypt(config.encrypted_corpsecret);
    // 获取access_token
    const accessToken = await wechat.getToken(config.corpid, corpsecret);
    // 组装消息内容
    const message = title ? `${title}\n${content}` : content;
    // 发送消息
    const result = await wechat.sendMessage(
        accessToken,
        config.agentid,
        config.touser,
        message
    );
    return result;
}

/**
 * 获取配置（不返回敏感信息）
 * @param {string} code - 唯一配置code
 * @returns {Promise<Object>} - 配置信息
 */
async function getConfiguration(code) {
    const config = await db.getConfigurationByCode(code);
    if (!config) return null;

    const result = {
        code: config.code,
        corpid: config.corpid,
        agentid: config.agentid,
        touser: config.touser.split('|'),
        description: config.description,
        callback_enabled: config.callback_enabled === 1,
        created_at: config.created_at
    };

    // 如果启用了回调，添加回调相关信息（不包含敏感数据）
    if (config.callback_enabled) {
        result.callback_token = config.callback_token;
        result.callbackUrl = `/api/callback/${config.code}`;
    }

    return result;
}

/**
 * 更新配置
 * @param {string} code - 唯一配置code
 * @param {Object} newConfig - 新的配置信息
 * @returns {Promise<{ message: string, code: string, callbackUrl?: string }>}
 */
async function updateConfiguration(code, newConfig) {
    const config = await db.getConfigurationByCode(code);
    if (!config) {
        throw new Error('无效的code，未找到配置');
    }

    // 如果提供了新的corpsecret，则加密
    let encrypted_corpsecret = config.encrypted_corpsecret;
    if (newConfig.corpsecret) {
        encrypted_corpsecret = crypto.encrypt(newConfig.corpsecret);
    }

    // 如果提供了新的encoding_aes_key，则加密
    let encrypted_encoding_aes_key = config.encrypted_encoding_aes_key;
    if (newConfig.encoding_aes_key) {
        encrypted_encoding_aes_key = crypto.encrypt(newConfig.encoding_aes_key);
    }

    // 更新数据库
    await db.updateConfiguration({
        code,
        corpid: newConfig.corpid || config.corpid,
        encrypted_corpsecret,
        agentid: newConfig.agentid || config.agentid,
        touser: newConfig.touser ? (Array.isArray(newConfig.touser) ? newConfig.touser.join('|') : newConfig.touser) : config.touser,
        description: newConfig.description !== undefined ? newConfig.description : config.description,
        callback_token: newConfig.callback_token !== undefined ? newConfig.callback_token : config.callback_token,
        encrypted_encoding_aes_key,
        callback_enabled: newConfig.callback_enabled !== undefined ? (newConfig.callback_enabled ? 1 : 0) : config.callback_enabled
    });

    const result = { message: '配置更新成功', code };
    if (newConfig.callback_enabled || config.callback_enabled) {
        result.callbackUrl = `/api/callback/${code}`;
    }
    return result;
}

/**
 * 处理回调验证
 * @param {string} code - 唯一配置code
 * @param {string} msgSignature - 消息签名
 * @param {string} timestamp - 时间戳
 * @param {string} nonce - 随机数
 * @param {string} echoStr - 回显字符串
 * @returns {Promise<{ success: boolean, data?: string, error?: string }>}
 */
async function handleCallbackVerification(code, msgSignature, timestamp, nonce, echoStr) {
    try {
        // 查询配置
        const config = await db.getConfigurationByCode(code);
        if (!config || !config.callback_enabled) {
            return { success: false, error: '回调未启用或配置不存在' };
        }

        if (!config.callback_token || !config.encrypted_encoding_aes_key) {
            return { success: false, error: '回调配置不完整' };
        }

        // 解密encoding_aes_key
        const encodingAESKey = crypto.decrypt(config.encrypted_encoding_aes_key);

        // 创建回调加密实例
        const callbackCrypto = new WeChatCallbackCrypto(
            config.callback_token,
            encodingAESKey,
            config.corpid
        );

        // 验证URL
        const result = callbackCrypto.verifyURL(msgSignature, timestamp, nonce, echoStr);
        return result;
    } catch (error) {
        console.error('回调验证失败:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * 处理回调消息
 * @param {string} code - 唯一配置code
 * @param {string} encryptedData - 加密的消息数据
 * @param {string} msgSignature - 消息签名
 * @param {string} timestamp - 时间戳
 * @param {string} nonce - 随机数
 * @returns {Promise<{ success: boolean, message?: Object, error?: string }>}
 */
async function handleCallbackMessage(code, encryptedData, msgSignature, timestamp, nonce) {
    try {
        // 查询配置
        const config = await db.getConfigurationByCode(code);
        if (!config || !config.callback_enabled) {
            return { success: false, error: '回调未启用或配置不存在' };
        }

        if (!config.callback_token || !config.encrypted_encoding_aes_key) {
            return { success: false, error: '回调配置不完整' };
        }

        // 解密encoding_aes_key
        const encodingAESKey = crypto.decrypt(config.encrypted_encoding_aes_key);

        // 创建回调加密实例
        const callbackCrypto = new WeChatCallbackCrypto(
            config.callback_token,
            encodingAESKey,
            config.corpid
        );

        // 解密消息
        const decryptResult = callbackCrypto.decryptMsg(encryptedData, msgSignature, timestamp, nonce);
        if (!decryptResult.success) {
            return decryptResult;
        }

        // 解析XML消息
        const message = callbackCrypto.parseXMLMessage(decryptResult.data);

        // 记录消息日志
        console.log(`[回调消息] Code: ${code}, 发送者: ${message.fromUserName}, 类型: ${message.msgType}`);
        if (message.msgType === 'text') {
            console.log(`[回调消息] 内容: ${message.content}`);
        }

        return { success: true, message };
    } catch (error) {
        console.error('回调消息处理失败:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    createCallbackConfiguration,
    completeConfiguration,
    createConfiguration,
    sendNotification,
    getConfiguration,
    updateConfiguration,
    handleCallbackVerification,
    handleCallbackMessage
};
