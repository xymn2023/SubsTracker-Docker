// 企业微信通知转发服务 - 主入口文件
// 作者: AI Assistant
// 创建时间: 2025-01-05

require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('express').json;
const routes = require('./src/api/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// 为回调接口使用原始文本解析器
app.use('/api/callback', express.raw({ type: 'text/xml' }));
app.use('/api/callback', express.raw({ type: 'application/xml' }));
app.use('/api/callback', express.raw({ type: 'text/plain' }));

// 解析JSON请求体（其他接口）
app.use(bodyParser());

// 静态资源服务
app.use('/public', express.static(path.join(__dirname, 'public')));

// 路由
app.use('/', routes);

// 404处理
app.use((req, res) => {
    res.status(404).json({ error: '未找到资源' });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`企业微信通知服务已启动，端口: ${PORT}`);
}); 
