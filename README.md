# 订阅管理系统

基于Python+Flask的订阅管理系统，支持订阅费用统计和通知提醒功能。

## 功能特点

- 订阅管理：添加、编辑、删除和查看订阅
- 费用统计：统计订阅的费用支出，生成图表展示
- 到期提醒：自动检查即将到期的订阅并发送通知
  - 支持多种通知方式：Telegram、企业微信、NotifyX
- Docker支持：提供Docker部署方案，方便快速部署

## 安装部署

### 使用Docker部署（推荐）

1. 克隆仓库：

```bash
git clone https://github.com/xymn2023/SubsTracker-Docker
cd SubsTracker-Docker
```

2. 使用docker-compose启动服务：

```bash
docker-compose up -d
```

3. 访问系统：

打开浏览器，访问 http://localhost:5000

默认管理员账号：
- 用户名：admin
- 密码：password

### 手动部署

1. 克隆仓库：

```bash
git clone https://github.com/xymn2023/SubsTracker-Docker
cd SubsTracker-Docker
```

2. 创建虚拟环境并安装依赖：

```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或者 venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

3. 运行应用：

```bash
python run.py
```

4. 访问系统：

打开浏览器，访问 http://localhost:5000

## 配置说明

系统配置存储在`data/config.json`文件中，也可以通过环境变量设置：

```
ADMIN_USERNAME: 管理员用户名
ADMIN_PASSWORD: 管理员密码
NOTIFICATION_TYPE: 通知方式 (telegram, wecom, notifyx)

# Telegram配置
TG_BOT_TOKEN: Telegram Bot Token
TG_CHAT_ID: Telegram 聊天ID

# 企业微信配置 
WECOM_CORP_ID: 企业ID
WECOM_AGENT_ID: 应用ID
WECOM_CORP_SECRET: 应用密钥

# NotifyX配置
NOTIFYX_API_KEY: NotifyX API密钥

SECRET_KEY: 应用密钥
```

## 通知设置

系统支持三种通知方式，您可以在配置页面中选择使用哪种方式发送通知：

### Telegram 通知设置

1. 在Telegram中搜索 @BotFather 并创建一个新机器人
2. 获取机器人的Token
3. 搜索 @userinfobot 获取你的Chat ID
4. 在系统配置页面填入Token和Chat ID
5. 点击"测试Telegram配置"按钮进行测试

### 企业微信通知设置

1. 登录 [企业微信管理后台](https://work.weixin.qq.com/wework_admin/)
2. 创建一个自建应用（应用管理 -> 自建应用 -> 创建应用）
3. 获取企业ID (CorpID)、应用ID (AgentID) 和应用密钥 (Secret)
4. 在系统配置页面填入相关信息
5. 点击"测试企业微信配置"按钮进行测试

### NotifyX通知设置

1. 注册并登录 [NotifyX网站](https://www.notifyx.cn/)
2. 创建通知渠道并获取API密钥
3. 在系统配置页面填入API密钥
4. 点击"测试NotifyX配置"按钮进行测试

## 数据存储

所有数据存储在`data`目录下的JSON文件中：

- `config.json`: 系统配置
- `subscriptions.json`: 订阅数据

## 开发说明

### 项目结构

```
subscription-manager/
├── app/                  # 应用主目录
│   ├── models/           # 数据模型
│   ├── routes/           # 路由控制器
│   ├── services/         # 业务逻辑服务
│   ├── static/           # 静态资源
│   ├── templates/        # 模板文件
│   └── __init__.py       # 应用初始化
├── data/                 # 数据存储目录
├── docker/               # Docker配置文件
├── requirements.txt      # 依赖列表
├── Dockerfile            # Docker构建文件
├── docker-compose.yml    # Docker Compose配置
└── run.py                # 应用入口
```

## 许可证

本项目采用 MIT 许可证。 
