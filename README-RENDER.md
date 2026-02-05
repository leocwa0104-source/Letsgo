# 部署到 Render 指南

既然 Vercel 的函数额度不够用了，我们推荐将后端服务迁移到 **Render**。
你的代码已经准备好了（已添加 `start` 脚本），请按照以下步骤操作：

## 第一步：准备代码
1. 确保你的本地代码已提交并推送到 GitHub。

## 第二步：在 Render 上创建服务
1. 访问 [Render Dashboard](https://dashboard.render.com/) 并登录。
2. 点击 **"New +"** -> **"Web Service"**.
3. 连接你的 GitHub 仓库。
4. **配置参数**：
   - **Name**: `shineshone-api` (或者你喜欢的名字)
   - **Region**: 选择离用户近的 (如 Singapore 或 Oregon)
   - **Branch**: `main` (或 master)
   - **Root Directory**: `.` (默认)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: 推荐 **Starter ($7/month)** 以保证定位服务不休眠。

5. **环境变量 (Environment Variables)**：
   点击 "Advanced" 或 "Environment" 标签，添加以下变量（从你的 `.env` 文件或 Vercel 设置中复制）：
   - `MONGODB_URI`: 你的 MongoDB 连接字符串
   - `ADMIN_USERNAME`: 管理员用户名
   - `JWT_SECRET`: (如果有的话)
   - `NODE_VERSION`: `20`

6. 点击 **"Create Web Service"**。

## 第三步：连接前端 (Vercel) 到后端 (Render)
部署成功后，Render 会给你一个 URL，例如 `https://shineshone-api.onrender.com`。

你需要告诉 Vercel 把 `/api` 请求转发给 Render。

1. 打开项目根目录下的 `vercel.json` 文件。
2. 修改 `rewrites` 部分，将 destination 改为你的 Render 网址：

```json
{
  "version": 2,
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://shineshone-api.onrender.com/api/$1" },
    { "source": "/(.*)", "destination": "/$1" }
  ]
}
```

3. 提交 `vercel.json` 的修改并推送到 GitHub。

## 完成！
现在：
- **前端** 依然在 Vercel (免费，速度快)。
- **后端** 在 Render (稳定，无函数次数限制)。
- 你的 App 和网页都不需要改代码，它们会自动通过 Vercel 的转发连接到新服务器。
