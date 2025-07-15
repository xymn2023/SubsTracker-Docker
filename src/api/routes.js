// Express路由定义
// 包含所有API端点的路由配置

const express = require('express');
const path = require('path');
const notifier = require('../services/notifier');
const WeChatService = require('../core/wechat');
const CryptoService = require('../core/crypto');

const router = express.Router();

// 环境变量
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-for-development-only';
const wechat = new WeChatService();
const crypto = new CryptoService(ENCRYPTION_KEY);

// 1. GET / 返回前端页面
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// 2. POST /api/validate 验证凭证并获取成员列表
router.post('/api/validate', async (req, res) => {
    const { corpid, corpsecret } = req.body;
    if (!corpid || !corpsecret) {
        return res.status(400).json({ error: '参数不完整' });
    }
    try {
        const accessToken = await wechat.getToken(corpid, corpsecret);
        const users = await wechat.getAllUsers(accessToken);
        res.json({ users });
    } catch (err) {
        res.status(400).json({ error: err.message || '凭证无效或API请求失败' });
    }
});

// 2.1 POST /api/generate-callback 生成回调URL
router.post('/api/generate-callback', async (req, res) => {
    const { corpid, callback_token, encoding_aes_key } = req.body;
    if (!corpid || !callback_token || !encoding_aes_key) {
        return res.status(400).json({ error: '回调配置参数不完整' });
    }
    if (encoding_aes_key.length !== 43) {
        return res.status(400).json({ error: 'EncodingAESKey必须是43位字符' });
    }
    try {
        // 生成回调配置（不需要成员列表）
        const result = await notifier.createCallbackConfiguration({
            corpid,
            callback_token,
            encoding_aes_key
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message || '生成回调URL失败' });
    }
});

// 3. POST /api/complete-config 完善配置（第二步）
router.post('/api/complete-config', async (req, res) => {
    try {
        const { code, corpsecret, agentid, touser, description } = req.body;
        const result = await notifier.completeConfiguration({ code, corpsecret, agentid, touser, description });
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message || '完善配置失败' });
    }
});

// 3.1 POST /api/configure 保存配置并生成唯一code（保持兼容性）
router.post('/api/configure', async (req, res) => {
    try {
        const { corpid, corpsecret, agentid, touser, description } = req.body;
        const result = await notifier.createConfiguration({ corpid, corpsecret, agentid, touser, description });
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message || '配置保存失败' });
    }
});

// 4. POST /api/notify/:code 发送通知
router.post('/api/notify/:code', async (req, res) => {
    const { code } = req.params;
    const { title, content } = req.body;
    if (!content) {
        return res.status(400).json({ error: '消息内容不能为空' });
    }
    try {
        const result = await notifier.sendNotification(code, title, content);
        res.json({ message: '发送成功', response: result });
    } catch (err) {
        if (err.message && err.message.includes('未找到配置')) {
            res.status(404).json({ error: err.message });
        } else {
            res.status(500).json({ error: err.message || '消息发送失败' });
        }
    }
});

// 5. GET /api/configuration/:code 获取配置信息
router.get('/api/configuration/:code', async (req, res) => {
    const { code } = req.params;
    try {
        const config = await notifier.getConfiguration(code);
        if (!config) {
            return res.status(404).json({ error: '未找到配置' });
        }
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: err.message || '获取配置失败' });
    }
});

// 6. PUT /api/configuration/:code 更新配置
router.put('/api/configuration/:code', async (req, res) => {
    const { code } = req.params;
    try {
        const result = await notifier.updateConfiguration(code, req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message || '更新配置失败' });
    }
});

// 7. GET /api/callback/:code 企业微信回调验证
router.get('/api/callback/:code', async (req, res) => {
    const { code } = req.params;
    const { msg_signature, timestamp, nonce, echostr } = req.query;

    if (!msg_signature || !timestamp || !nonce || !echostr) {
        return res.status(400).json({ error: '缺少必要的验证参数' });
    }

    try {
        const result = await notifier.handleCallbackVerification(code, msg_signature, timestamp, nonce, echostr);
        if (result.success) {
            res.send(result.data);
        } else {
            console.error('回调验证失败:', result.error);
            res.status(400).send('failed');
        }
    } catch (err) {
        console.error('回调验证异常:', err.message);
        res.status(500).send('failed');
    }
});

// 8. POST /api/callback/:code 企业微信回调消息接收
router.post('/api/callback/:code', async (req, res) => {
    const { code } = req.params;
    const { msg_signature, timestamp, nonce } = req.query;

    if (!msg_signature || !timestamp || !nonce) {
        return res.status(400).json({ error: '缺少必要的验证参数' });
    }

    try {
        // 获取加密的消息数据（从原始body转换为字符串）
        const encryptedData = req.body ? req.body.toString('utf8') : '';
        if (!encryptedData) {
            return res.status(400).json({ error: '消息数据为空' });
        }

        const result = await notifier.handleCallbackMessage(code, encryptedData, msg_signature, timestamp, nonce);
        if (result.success) {
            console.log('回调消息处理成功:', result.message);
            res.send('ok');
        } else {
            console.error('回调消息处理失败:', result.error);
            res.status(400).send('failed');
        }
    } catch (err) {
        console.error('回调消息处理异常:', err.message);
        res.status(500).send('failed');
    }
});

module.exports = router;
