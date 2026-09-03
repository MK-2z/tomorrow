# 构建阶段
FROM node:22-alpine AS builder
WORKDIR /app

# 复制依赖文件
COPY package.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY nest-cli.json ./

# 复制源代码
COPY client ./client
COPY server ./server
COPY shared ./shared

# 安装依赖
RUN npm install

# 构建前端和后端
RUN npm run build

# 运行阶段
FROM node:22-alpine
WORKDIR /app

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server/database/init.sql ./server/database/init.sql

# 创建上传目录
RUN mkdir -p ./uploads

# 暴露端口
EXPOSE 3000

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 启动命令
CMD ["node", "dist/server/main.js"]
