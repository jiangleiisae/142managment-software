# 部署指南

## 当前生产环境

- 地址: https://training.feiken.group
- 服务器: 腾讯云轻量应用服务器, 上海节点, 2核2G, Ubuntu 24.04
- 备案: 沪ICP备2026041402号-1 (主域名 `feiken.group` 已备案并接入该服务器; 子域名按规则自动可用,
  无需单独备案, 但首次启用时记得去轻量服务器的"防火墙"面板确认 443 端口已放行——这台服务器上
  实际踩过一次坑: 安全组/防火墙默认只放行了80, 没放行443, 现象是域名和裸IP访问443都"连接被重置",
  和证书、备案都无关, 排查时不要被误导)
- 部署方式: tar 打包同步 (见下方"更新部署", 原因是该服务器访问 GitHub 不稳定)

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

### 版本管理

- 版本号遵循语义化版本 (`apps/api/package.json` 和 `apps/web/package.json` 的 `version` 字段), 每个正式发布版本对应一个 git tag (如 `v1.0.0`), 变更内容记录在 [CHANGELOG.md](CHANGELOG.md)。
- 打标签: `git tag -a v1.1.0 -m "简述这个版本的主要变化" && git push origin v1.1.0`。

### 更新部署

**如果部署服务器能稳定访问 GitHub**, 走标准流程:

```bash
git pull
docker compose up -d --build
```

**如果服务器在中国大陆且访问 GitHub 不稳定**(本项目当前的生产环境就是这种情况, 实测 `git clone`/`git pull` 会超时), 改为从本地开发机把代码同步过去再部署:

```bash
# 在本地仓库根目录执行, 把代码打包推送到服务器上已有的 ~/tcms 目录并重新部署
tar --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='uploads' --exclude='*.tsbuildinfo' -czf - . | \
  ssh <部署用户>@<服务器IP> "tar -xzf - -C ~/tcms"
ssh <部署用户>@<服务器IP> "cd ~/tcms && sudo docker compose up -d --build"
```

镜像构建默认走 npmmirror (npm 包、Node 头文件、Prisma 引擎都从国内镜像下载), 配置在 `apps/api/Dockerfile` 和 `apps/web/Dockerfile` 里, 已提交进仓库, 解压覆盖代码不会丢失; 在能直连官方源的环境构建时可用 `--build-arg NPM_REGISTRY=...` 等参数覆盖。

`migrate` 服务会在每次 `up` 时自动重新运行 `prisma migrate deploy` (对已应用的迁移是幂等的, 只会应用新增的迁移)。

### 回滚

两种情况都适用: 先确认要回滚到哪个 git tag/commit, 然后:

```bash
git checkout v1.0.0   # 或具体的 commit hash
```

再按上面"更新部署"的方式重新打包/拉取并 `docker compose up -d --build` 即可。数据库迁移是只增不减的, 回滚代码版本通常不需要也不应该回滚数据库结构 (除非该版本本身就包含需要撤销的迁移, 这种情况需要手动评估, Prisma 没有自动"降级迁移"的机制)。

## 环境变量参考

见 [.env.example](.env.example)。后端还支持但通常不需要覆盖的变量 (有开发环境默认值), 详见 [apps/api/README.md](apps/api/README.md) 和 [apps/api/.env.test](apps/api/.env.test) (测试专用, 已 gitignore)。

## 文件存储: 本地磁盘 vs 对象存储

上传的文件 (目前是 QTG/MQTG 文档) 默认存本地磁盘 (`STORAGE_DRIVER=local`, 落在 `api_uploads` volume 里)。
单机部署没问题; 要横向扩展成多个 `api` 实例, 或不想依赖本地磁盘持久化, 在 `.env` 里切到对象存储:

```bash
STORAGE_DRIVER=s3
S3_BUCKET=your-bucket-name
S3_REGION=auto                 # AWS S3 用具体 region (如 us-east-1), R2 用 "auto"
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com  # AWS S3 留空即可
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=true       # 自建 MinIO / 部分非AWS的S3兼容服务需要; AWS S3/R2留空
```

代码用的是标准 S3 协议 (`@aws-sdk/client-s3`), 已用 localstack (开源S3兼容模拟器) 验证过真实的上传/下载/列举全流程, 理论上同样适用于 AWS S3、阿里云/腾讯云 OSS 的 S3 兼容模式、Cloudflare R2、自建 MinIO 等任何标准 S3 协议的服务 (通过 `S3_ENDPOINT` 指向对应服务)。切换存储后端不会丢失已有的数据库记录, 但**已经存在本地磁盘里的旧文件不会自动搬到新存储**, 需要手动迁移 (把 `api_uploads` volume 里的文件按原文件名上传到新bucket, 数据库里的 `pointerUrl` 字段存的就是文件名/key)。

`docker compose up -d --build` 后重启 `api` 服务 (`docker compose restart api`) 即可生效。

## 通知: 站内通知 + 短信

系统事件(目前是"强制事件报告超72小时未上报", 见 ORA.GEN.160)会触发通知, 每小时自动扫描一次
(`@nestjs/schedule` 定时任务), 也可以用 `POST /notifications/check-overdue-occurrence-reports`
(仅 OWNER/ADMIN) 手动立即触发一次, 不必等下一次整点。同一条记录只会通知一次, 不会每小时重复打扰。

- **站内通知**: 默认开启, 无需配置。通知会送到该机构"安全经理(SAFETY_MANAGER)"角色任命对应的登录
  账户收件箱 (`GET /notifications`)。登录账户需要先关联到人员档案才能收到——在"用户与权限"页面给
  对应账户点"关联人员"即可 (`POST /users/:id/link-personnel`)。
- **短信通知**: 默认 `SMS_PROVIDER=log`, 只把短信内容打到后端日志里, 不真实发送(开发/测试环境不需要
  短信账号)。要真实发送, 设置:
  ```bash
  SMS_PROVIDER=aliyun
  ALIYUN_ACCESS_KEY_ID=...
  ALIYUN_ACCESS_KEY_SECRET=...
  ALIYUN_SMS_SIGN_NAME=...        # 须提前在阿里云控制台报备审核通过的签名
  ALIYUN_SMS_TEMPLATE_CODE=...    # 须提前报备审核通过的短信模板
  ALIYUN_SMS_TEMPLATE_PARAM_KEY=content  # 模板里承载消息正文的变量名, 按实际模板调整
  ```
  **未做过真实发送验证** —— 没有真实阿里云账号和已报备模板可供联调, 代码是对照官方 SDK 文档实现的,
  上线前务必用真实账号跑一次确认签名/模板参数无误。

要把"到期提醒"机制接入其他场景(PM任务、ERP演练、QTG季度运行、资质到期等), 照搬
`src/notifications/occurrence-report-alert.service.ts` 的模式: 定时扫描 + `NotificationService.notify()`
+ `findExistingNotification()` 去重即可, 目前只落地了事件报告这一个场景。

## 已知限制 (尚未处理的部署相关事项)

- `docker-compose.yml` 未包含 Redis, 因为当前代码还没有实际使用它 (`.env` 里的 `REDIS_URL` 是预留位)。
