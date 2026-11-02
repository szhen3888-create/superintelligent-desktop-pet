# SI合宠 · 控制台（client）

Electron 控制台代码目录。产品说明见仓库根目录 `README.md` 与 `使用说明.txt`。

本目录基于小小桌宠客户端二次开发，并接入 CrossPet 合集页与双引擎切换逻辑。

## 关键文件

| 文件 | 作用 |
|---|---|
| `main.cjs` | 主进程、托盘、IPC、CrossPet 窗 |
| `renderer.js` | 我的角色主页 |
| `collections/` | 「修改形象」二级页 |
| `crosspet-*.cjs` | CrossPet 状态、桌宠窗、钩子 |
| `ai.cjs` / `chat-bridge.cjs` | API 对话与看屏桥 |
| `service.cjs` | 连接本地 dsh-pet 服务（3081） |

角色运行时数据在用户目录 `%USERPROFILE%\.dsh\dsh-pet\`，不在本文件夹内持久化。
