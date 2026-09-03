# 素质评价分收集系统 - 部署说明

## 项目简介

一个基于 React + NestJS + PostgreSQL 的学生素质评价分收集与管理系统，支持学生自评、管理员审查、用户管理、操作日志等功能。系统完全自包含，使用学号 + 密码登录，无需任何第三方授权（飞书 / OAuth 等）。

## 技术栈

- **前端**：React 19 + TypeScript + Vite + TailwindCSS + shadcn/ui
- **后端**：NestJS 10 + TypeScript
- **数据库**：PostgreSQL 15+（需要支持 uuid-ossp 扩展）
- **ORM**：Drizzle ORM
- **认证**：自建 Token 认证（学号 + 密码 + localStorage）

## 项目结构

```
.
├── client/              # React 前端
│   ├── index.html
│   ├── public/          # 静态资源
│   └── src/
│       ├── api/         # 后端 API 封装
│       ├── components/  # 通用组件
│       ├── contexts/    # 全局 Context（Auth 等）
│       ├── pages/       # 页面
│       │   ├── login/          # 登录页（学生/教师双 Tab）
│       │   ├── quality-eval/   # 学生评价填写页
│       │   ├── quality-eval-list/ # 评价记录列表
│       │   ├── review-list/    # 审查工作台
│       │   ├── review-detail/  # 审查详情
│       │   ├── user-management/ # 用户管理
│       │   ├── operation-logs/  # 操作日志
│       │   ├── fill-time-settings/ # 填报时间设置
│       │   └── NotFound/        # 404 页
│       ├── hooks/       # 自定义 Hooks
│       ├── utils/       # 工具函数
│       ├── app.tsx      # 路由定义
│       └── index.tsx    # 入口
├── server/              # NestJS 后端
│   ├── main.ts          # 入口
│   ├── app.module.ts    # 根模块
│   ├── config/          # 配置
│   ├── modules/
│   │   ├── auth/        # 认证与用户管理模块
│   │   ├── quality-eval/ # 素质评价模块
│   │   └── view/        # 视图渲染模块
│   ├── database/        # Drizzle ORM Schema
│   └── common/          # 共享工具
├── shared/              # 前后端共享类型
│   └── api.interface.ts
├── package.json         # 根依赖
├── nest-cli.json        # Nest CLI 配置
├── vite.config.ts       # Vite 配置
├── tailwind.config.ts   # Tailwind 配置
├── tsconfig.json        # TypeScript 配置
└── README.md            # 本文件
```

## 环境要求

- **Node.js** >= 22.0.0
- **PostgreSQL** >= 15（需启用 `uuid-ossp` 扩展）
- **npm**（随 Node.js 自带）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env` 文件，配置以下变量：

```bash
# 服务端口
SERVER_PORT=3000
SERVER_HOST=0.0.0.0

# 数据库连接（PostgreSQL）
DATABASE_URL=postgresql://username:password@localhost:5432/quality_eval?schema=public

# Node 环境
NODE_ENV=development
```

> **说明**：系统使用 PostgreSQL 作为数据库。你需要手动创建数据库并启用 uuid-ossp 扩展：
>
> ```sql
> CREATE DATABASE quality_eval;
> \c quality_eval
> CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
> ```

### 3. 初始化数据库表

项目使用 Drizzle ORM。表结构定义在 `server/database/schema.ts` 中。首次部署时需要建表：

```bash
# 使用 drizzle-kit 推送表结构（需先安装 drizzle-kit）
npx drizzle-kit push
```

或者，你也可以手动执行建表 SQL。核心表包括：

- `quality_eval_users` — 用户表（学号、密码哈希、角色等）
- `quality_eval_records` — 评价记录表
- `quality_eval_operation_logs` — 操作日志表
- `quality_eval_settings` — 系统设置表

### 4. 启动开发模式

前端（端口默认 5173）和后端（端口 3000）分别启动：

```bash
# 方式一：分别启动（推荐开发用）
# 启动后端
npm run dev:server

# 另起一个终端，启动前端
npm run dev:client
```

访问 `http://localhost:5173` 即可使用。

### 5. 生产构建与部署

```bash
# 构建前端和后端
npm run build

# 启动生产服务
npm run start:prod
```

## 功能模块

| 模块 | 路径 | 说明 |
|------|------|------|
| 学生登录 | `/login`（学生 Tab） | 学号 + 密码登录 |
| 教师/管理员登录 | `/login`（教师 Tab） | 管理员账号 + 密码登录 |
| 评价填写 | `/eval` | 学生自评，填写各维度评分与佐证材料 |
| 评价记录 | `/records` | 学生查看自己的评价记录和状态 |
| 审查工作台 | `/review` | 管理员审查评价、批注、通过/驳回 |
| 用户管理 | `/users` | 超级管理员管理用户（增删改查、角色设置、批量删除） |
| 操作日志 | `/logs` | 超级管理员查看所有操作日志 |
| 填报时间设置 | `/settings/fill-time` | 超级管理员设置可填报时间范围 |

## 角色与权限

- **普通学生（student）**：填写评价、查看自己的记录
- **学生管理员（admin）**：审查评价、查看用户列表（搜索/筛选）
- **超级管理员（super_admin）**：所有权限 + 用户管理 + 操作日志 + 系统设置

## 默认账号

部署后请使用以下默认账号登录，并**尽快修改密码**：

| 角色 | 学号 | 密码 | 说明 |
|------|------|------|------|
| 超级管理员 | `0001` | `admin123` | 最高权限，不可删除 |
| 学生管理员 | `0002` | `admin123` | 审查员权限 |
| 普通学生 | `2024001` | `123456` | 学生示例账号 |
| 普通学生 | `2024002` | `123456` | 学生示例账号 |
| 普通学生 | `2024003` | `123456` | 学生示例账号 |

> **如果上述账号不存在**，请在数据库中手动创建超级管理员账号。密码哈希使用 bcrypt，你可以通过 Node.js 生成：
>
> ```js
> const bcrypt = require('bcrypt');
> const hash = bcrypt.hashSync('admin123', 10);
> console.log(hash);
> ```
>
> 然后执行 SQL：
> ```sql
> INSERT INTO quality_eval_users (student_id, password_hash, role, display_name, class_name)
> VALUES ('0001', '<生成的hash>', 'super_admin', '超级管理员', '系统');
> ```

## 部署到其他平台说明

### Docker 部署（推荐）

可以创建一个 Dockerfile 同时构建前端和后端：

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

### 环境变量清单

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `SERVER_PORT` | `3000` | 后端服务端口 |
| `SERVER_HOST` | `localhost` | 后端监听地址 |
| `DATABASE_URL` | - | PostgreSQL 连接串 |
| `NODE_ENV` | `development` | 运行环境，生产环境设为 `production` |
| `CLIENT_BASE_PATH` | `/` | 前端部署子路径（非根路径部署时设置） |

### Nginx 反向代理

生产环境建议用 Nginx 做反向代理和静态文件服务：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态资源
    root /path/to/dist/client;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 常见问题

### Q: 数据库连接失败怎么办？

检查 `DATABASE_URL` 格式是否正确，确保 PostgreSQL 服务在运行，且数据库用户有对应权限。

### Q: 登录提示"学号或密码错误"？

确认用户表中是否有对应记录，密码是否使用 bcrypt 哈希存储。可以通过用户管理页面添加新用户，或直接在数据库中插入。

### Q: 如何修改超级管理员密码？

登录超级管理员账号后，点击右上角"修改密码"按钮，或直接在数据库中更新 `password_hash` 字段。

### Q: 可以部署到 Serverless / PaaS 平台吗？

可以。后端是标准 NestJS HTTP 服务，前端是纯静态构建产物，支持 Vercel / Railway / Render / 阿里云函数计算等大多数平台。注意配置好 `DATABASE_URL` 环境变量。

## License

本项目用于内部使用，请根据实际需求自行扩展。
