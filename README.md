# SI合宠（superintelligent-desktop-pet）

**让喜欢的 AI 陪在桌面上。**

Windows 桌面宠物客户端。在开源项目上二次整合：小小桌宠 WebM 控制台 + CrossPet 换装 + 大肥鱼式右键交互。

当前版本：**v1.1.0**

---

## 下载（完整软件）

请到 **[Releases](https://github.com/szhen3888-create/superintelligent-desktop-pet/releases)** 下载：

- `SI合宠-v1.1.0-windows.zip`

解压后双击 **`SI合宠.exe`**。请保留完整文件夹，不要只拷贝 exe。

> 完整客户端体积较大，不能放进 Git 仓库（单文件超过 GitHub 100MB 限制），因此通过 Releases 提供下载。

---

## 这是二次开发

本项目不是从零重写，请尊重上游作者与许可：

| 上游 | 用途 | 许可 |
|---|---|---|
| [小小桌宠](https://github.com/yshuang722-spec/xiaoxiao-zhuochong) | 控制台与发行骨架 | 随上游 |
| [dsh-pet](https://github.com/PC2005-cloud/dsh-pet)（PC2005-cloud） | WebM 引擎 | MIT |
| [CrossPet](https://github.com/lokicorvus/crosspet)（lokicorvus） | 立绘合集 / 换装 / 钩子资源 | 代码 MIT；**立绘 CC BY-NC-SA 4.0（非商业）** |
| [大肥鱼](https://github.com/MerZlin/dsh-pet-indesktop)（MerZlin） | 右键交互参考 | 随上游 |

详见 [NOTICE.md](NOTICE.md)、[LICENSE.md](LICENSE.md)。仓库根目录 [LICENSE](LICENSE) 为对本整合修改适用的 MIT。

**商标归各自公司；本项目为非官方同人桌宠。立绘默认不可商用。**

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

## 数据目录

| 内容 | 路径 |
|---|---|
| WebM 角色配置 | `%USERPROFILE%\.dsh\dsh-pet\` |
| CrossPet 状态 | `%LOCALAPPDATA%\SI-HeChong\` |

---

## 致谢

感谢小小桌宠、dsh-pet、CrossPet、大肥鱼及立绘相关社区作者。欢迎 Issue / PR。
