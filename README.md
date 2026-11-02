# SI合宠（superintelligent-desktop-pet）

**让喜欢的 AI 陪在桌面上。**

Windows 桌面宠物。二次整合：小小桌宠 WebM 控制台 + CrossPet 换装 + 大肥鱼式右键交互。

当前版本：**v1.1.0**

---

## Windows 下载

**[下载完整客户端（解压即用）](https://github.com/szhen3888-create/superintelligent-desktop-pet/releases/download/v1.1.0/SI-HeChong-v1.1.0-windows.zip)** · [Releases 页](https://github.com/szhen3888-create/superintelligent-desktop-pet/releases/tag/v1.1.0)

解压后双击 **`SI合宠.exe`**。请保留完整文件夹，不要只拷贝 exe。无需另装 Node。

> GitHub 自动生成的 Source code 是源码树；日常使用请下载上面的完整客户端 ZIP。`SI合宠.exe` 超过 GitHub 单文件 100MB 限制，故发行包放在 Releases。

---

## 快速使用

1. 从 Releases 下载并解压 ZIP  
2. 运行 `SI合宠.exe`  
3. 主页打开角色开关 → 桌面出现宠物  
4. 「修改形象」可在「动作原版」(WebM) 与 CrossPet 衣服间切换  
5. 桌宠右键：动作点播、对话、看屏、大小等  
6. 关闭窗口后仍可从托盘打开；「退出全部桌宠」才会完全退出  

更细步骤见 [使用说明.txt](使用说明.txt)。版本记录见 [SI合宠更新版本.txt](SI合宠更新版本.txt)。

### 隐私提示

「看看屏幕 / 截图提问」会采集本机屏幕，并可能发送到你配置的第三方 AI 接口。仅限本人设备与合法用途；API 密钥保存在本机，勿提交到公开仓库。

---

## 源码与目录

本仓库按同类开源桌宠习惯组织（对齐小小桌宠）：

| 目录 | 内容 |
|---|---|
| `client/` | 控制台与整合逻辑（含 CrossPet 桥接、对话、看屏等） |
| `characters/` | WebM 角色配置、动画与人设 |
| `dsh-pet/` | WebM 桌宠引擎（`lib/`、`runtime/` 等） |
| `crosspet/` | CrossPet 立绘合集、hooks 与相关前端资源 |
| `bootstrap.cjs` / `package.json` | Electron 应用入口 |

完整可运行发行版还包含 Electron/Chromium 壳与运行时，这些不在 Git 中，请用 Releases ZIP。

数据目录：

| 内容 | 路径 |
|---|---|
| WebM 角色配置 | `%USERPROFILE%\.dsh\dsh-pet\` |
| CrossPet 状态 | `%LOCALAPPDATA%\SI-HeChong\` |

---

## 这是二次开发

请尊重上游作者与许可：

| 上游 | 用途 | 许可 |
|---|---|---|
| [小小桌宠](https://github.com/yshuang722-spec/xiaoxiao-zhuochong) | 控制台与发行骨架 | 随上游 |
| [dsh-pet](https://github.com/PC2005-cloud/dsh-pet)（PC2005-cloud） | WebM 引擎 | MIT |
| [CrossPet](https://github.com/lokicorvus/crosspet)（lokicorvus） | 立绘合集 / 换装 / 钩子 | 代码 MIT；**立绘 CC BY-NC-SA 4.0（非商业）** |
| [大肥鱼](https://github.com/MerZlin/dsh-pet-indesktop)（MerZlin） | 右键交互参考 | 随上游 |

详见 [NOTICE.md](NOTICE.md)、[LICENSE.md](LICENSE.md)。仓库根目录 [LICENSE](LICENSE) 为对本整合修改适用的 MIT。

**商标归各自公司；本项目为非官方同人桌宠。立绘默认不可商用。**

---

## 致谢

感谢小小桌宠、dsh-pet、CrossPet、大肥鱼及立绘相关社区作者。欢迎 Issue / PR。
