# Docker 部署指南

本文档提供了使用 Docker 部署Python+Flask的订阅管理系统，支持订阅费用统计和通知提醒功能。

- 安装 [Docker](https://www.docker.com/get-started)
- 安装 [Docker Compose](https://docs.docker.com/compose/install/)

## 配置

在部署前，请修改 `docker-compose.yml` 文件中的环境变量：

```yaml
environment:
  - PORT=12121                                        # 应用端口
  - DB_PATH=/app/database/notifier.db                 # 数据库路径（不建议修改）
  - ENCRYPTION_KEY=change-this-to-a-random-32-character-string  # 加密密钥（必须修改）
  - NODE_ENV=production                               # 运行环境
  - WECHAT_API_BASE=https://qyapi.weixin.qq.com       # 企业微信API地址
```

**重要提示**：请务必修改 `ENCRYPTION_KEY` 为一个随机的32字符字符串，以确保数据安全。

## 部署步骤

1. 克隆或下载项目代码到服务器

2. 进入项目目录
   ```bash
   cd wechat-notifier
   ```

3. 构建并启动容器
   ```bash
   docker-compose up -d
   ```

4. 查看容器运行状态
   ```bash
   docker-compose ps
   ```

5. 查看应用日志
   ```bash
   docker-compose logs -f
   ```

## 访问应用

部署成功后，可以通过以下地址访问应用：

```
http://your-server-ip:12121
```

## 数据持久化

应用数据存储在 `./database` 目录中，该目录已通过 Docker 卷映射到容器内部。备份数据时，只需复制此目录即可。

## 更新应用

当有新版本发布时，按照以下步骤更新：

1. 拉取最新代码
   ```bash
   git pull
   ```

2. 重新构建并启动容器
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

## 故障排除

如果遇到问题，请尝试以下步骤：

1. 检查日志
   ```bash
   docker-compose logs -f
   ```

2. 重启容器
   ```bash
   docker-compose restart
   ```

3. 完全重建容器
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

## 安全建议

1. 不要使用默认的加密密钥
2. 考虑使用反向代理（如 Nginx）并启用 HTTPS
3. 限制服务器防火墙，只开放必要端口