# 部署指南

## 一键部署 (Docker Compose)

前置要求: Docker + Docker Compose。

```bash
cp .env.example .env
# 编辑 .env, 至少填写 DB_PASSWORD 和 JWT_SECRET (JWT_SECRET 可用 openssl rand -hex 48 生成)

docker compose up -d --build
```

启动的服务:

| 服务 | 说明 | 默认端口 |
|---|---|---|
| `postgres` | 数据库, 数据持久化在 `postgres_data` volume | 仅容器内网络可达 |
| `migrate` | 一次性任务: 启动时自动执行 `prisma migrate deploy`, 成功后退出, `api` 等它完成才启动 | - |
| `api` | NestJS 后端, 上传文件持久化在 `api_uploads` volume | 仅容器内网络可达 (通过 `web` 反向代理暴露) |
| `web` | 前端静态文件 + nginx 反向代理 `/api/*` 到 `api` | `WEB_PORT` (默认 8080) |

部署完成后访问 `http://<服务器>:8080`。首个账户通过前端注册页 (或 `POST /api/auth/register`) 创建, 会自动成为该租户的 OWNER。

停止服务: `docker compose down`(加 `-v` 会连数据库数据一起删除, 谨慎使用)。

查看日志: `docker compose logs -f api` / `docker compose logs -f web`。

### 调试: 直接访问后端 API

生产环境下 `api` 容器故意不对外暴露端口 (只能通过 `web` 的 nginx 反向代理访问, 减少攻击面)。如需直接调试后端:

```bash
docker compose run --rm -p 3000:3000 --service-ports api
```

或临时给 `docker-compose.yml` 里的 `api` 服务加上 `ports: ['3000:3000']`。

### 更新部署

```bash
git pull
docker compose up -d --build
```

`migrate` 服务会在每次 `up` 时自动重新运行 `prisma migrate deploy` (对已应用的迁移是幂等的, 只会应用新增的迁移)。

## 环境变量参考

见 [.env.example](.env.example)。后端还支持但通常不需要覆盖的变量 (有开发环境默认值), 详见 [apps/api/README.md](apps/api/README.md) 和 [apps/api/.env.test](apps/api/.env.test) (测试专用, 已 gitignore)。

## 已知限制 (尚未处理的部署相关事项)

- 文件上传 (QTG/MQTG 文档等) 目前落地本地磁盘 (`api_uploads` volume), 尚未接入对象存储 (S3/OSS)。单机部署没问题, 多实例横向扩展前需要先迁移存储层。
- 告警目前是"拉取式" (前端主动查询到期项), 没有邮件/短信/站内推送通知。
- `docker-compose.yml` 未包含 Redis, 因为当前代码还没有实际使用它 (`.env` 里的 `REDIS_URL` 是预留位)。
