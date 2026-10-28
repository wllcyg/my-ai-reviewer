# ☁️ 项目云工具配置说明

本文档记录当前项目正在使用的两大核心云基础设施：**TiDB Cloud (云 MySQL 数据库)** 和 **Upstash (云 Redis 缓存)**。

> ⚠️ **安全规范**：为防止敏感凭证泄露，文档中不记录明文密码。具体密码及密钥请参考本地环境变量配置文件。

---

## 一、 云数据库 (MySQL) — TiDB Cloud

项目采用 **TiDB Cloud (Serverless)** 提供的全托管 MySQL 兼容云数据库，具备弹性伸缩与高可用能力。

- **云服务商**：TiDB Cloud (PingCAP)
- **部署地域**：AWS 欧洲法兰克福 (`eu-central-1`)
- **主机地址 (Host)**：`gateway01.eu-central-1.prod.aws.tidbcloud.com`
- **端口 (Port)**：`4000`
- **数据库名 (Database)**：`ry-vue`
- **用户名 (Username)**：`2Zmj6BSwNMH9RAo.root`
- **密码 (Password)**：`******`（见配置文件中的 `DB_PASSWORD`）
- **连接安全**：必须启用 **SSL 加密** (`DB_SSL=true`)
- **配置文件路径**：`nest-admin/.env.development`

---

## 二、 云缓存 (Redis) — Upstash

项目采用 **Upstash** 提供的 Serverless Redis，用于分布式 Token 校验、限流、Socket 适配器与任务队列调度。

- **云服务商**：Upstash
- **主机地址 (Host)**：`outgoing-alien-38484.upstash.io`
- **端口 (Port)**：`6379`
- **密码 (Password)**：`******`（见配置文件中的 `REDIS_PASSWORD`）
- **连接安全**：必须启用 **TLS/SSL 加密** (`REDIS_TLS=true`)
- **数据库编号 (DB)**：`0`
- **配置文件路径**：`nest-admin/.env.development`

---

## 三、 快速连通性检测命令

如需在本地或服务器测试网络连通性，可使用以下命令（密码替换为您本地 `.env` 中的实际值）：

### 1. MySQL (TiDB Cloud)
```bash
mysql -h gateway01.eu-central-1.prod.aws.tidbcloud.com -P 4000 -u 2Zmj6BSwNMH9RAo.root -p --ssl-mode=REQUIRED ry-vue
```

### 2. Redis (Upstash)
```bash
redis-cli --tls -h outgoing-alien-38484.upstash.io -p 6379 -a <YOUR_REDIS_PASSWORD> ping
# 返回 PONG 即表示连接正常
```
