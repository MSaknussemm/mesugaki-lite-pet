# 鲸鱼娘精简桌宠 · Mesugaki Lite Pet

一个 **Electron 透明桌宠**：读《东方妖妖梦》联机 mod 写出的日志，按游戏事件说一句台词、播一段动画。
不注入游戏、不读内存、不发按键——**只单向读两个文本文件**，游戏完全不知道桌宠存在。

> 桌宠也可以单独运行：没开游戏时它就待机，每隔 45～120 秒自己咕哝一句。

## 特性

- **6 段动画**：`idle` / `talk` / `angry` / `happy` / `tongue` / `failure`，1.25 倍速播放
- **事件驱动**：18 个事件共 167 句台词，最后一行按冷却随机挑一句
- **一句 7 秒**：气泡 + 动画 7.0 秒，加 0.6 秒收尾；**播放中不接新台词**（HTTP 返回 429，游戏事件直接丢弃，不排队）
- **始终置顶**：`screen-saver` 层级并每 2 秒重新抬升，压得住最大化窗口与窗口化游戏
- **交互**：拖动身体移动、滚轮只在角色身体的小椭圆内缩放（25%～150%）、右键菜单、托盘菜单
- **不抢焦点**：平时不可激活；只有右键菜单打开的那几秒会临时激活（否则原生菜单关不掉）

## 快速开始

### 方式一：下载源码 zip（推荐，最省事）

1. 点页面上方 **Code → Download ZIP**
2. 解压，进入 `mesugaki-lite-pet-*` 文件夹
3. 双击 **`setup.cmd`** —— 自动从 Electron 官方下载运行时（约 151MB，只需一次）
4. 双击 **`Start.cmd`** 启动

不需要装 Node.js。网络不方便时，手动下载
[Electron 45.2.3 win32-x64](https://github.com/electron/electron/releases/download/v45.2.3/electron-v45.2.3-win32-x64.zip)
并解压到 `runtime\` 目录即可，效果一样。

### 方式二：git clone

```bash
git clone https://github.com/MSaknussemm/mesugaki-lite-pet
cd mesugaki-lite-pet
```

然后同样双击 **`setup.cmd`** → **`Start.cmd`**。

### 方式三：开发者

```bash
npm install
npm start
```

### 接游戏日志

1. 启动游戏（联机 mod），确认它把日志写到 `<游戏目录>/mp_log.txt` 与 `bot_log.txt`。
2. 编辑 `config.json` 的 `game_dir` 指向该目录（Windows 路径要双反斜杠）。
3. 先开桌宠、再开游戏，或者反过来都行（启动时补读最近 5 分钟内的最后 10 行）。

## 配置

| 文件 | 内容 |
|---|---|
| `config.json` | `game_dir`、`port`、`events.<事件>.lines`、`animations`、`idle` |
| `idle-lines.txt` | 空闲台词，一行一句；存在时覆盖 `config.json` 里的 `idle.lines` |

改完**重启桌宠**才生效。

## 事件协议

游戏侧每行一条：

```
EVENT_NAME key=value key=value
```

桌宠用正则 `^([A-Z][A-Z_]+)` 取事件名，再查 `config.json` 的 `events` 表。带 `frame=` 的行按 `session|event|frame` 去重，防止网络回滚重放。

当前支持 18 个事件：

```
PLAYER_DIE  PLAYER_BOMB  GHOST
BOT_MISS  BOT_HIT  BOT_DEATHBOMB
POWER_FULL  POWER_LOW
STAGE_START  STAGE_CLEAR  BORDER_START  BORDER_END  SPELL_START  BOSS_ENTER
GAME_END  GAME_OVER  CONTINUE  SESSION_END
```

## 消息接口

`POST http://127.0.0.1:17837/message`，UTF-8 JSON：

```json
{"text":"笨蛋，又死了。","animation":"angry"}
```

```json
{"event":"PLAYER_DIE"}
```

- 202 接受；400 参数错误或未知事件；**429 正在播放**
- `duration_ms` 可选（1000–20000），默认 7000
- 仅绑定 `127.0.0.1`，拒绝带 `Origin` 的浏览器请求
- `GET /health` 返回队列、动画状态、窗口位置

## 许可

| 部分 | 许可 |
|---|---|
| 代码（`*.js`、`*.html`、`*.cmd`、`*.ps1`） | **MIT**，见 [LICENSE](LICENSE) |
| `assets/` 下的动画与图标 | **CC BY-NC-SA 4.0**，见 [NOTICE.md](NOTICE.md) 与 [LICENSES/](LICENSES/) |
| `game-patch/` 下的补丁 | 跟随上游（CC0），见该目录的 README |

**不含任何游戏本体数据**（`th07.dat`、`thbgm.dat`、`th07.exe` 等）。要用联机 mod 请自备正版游戏。

本项目与上海爱丽丝幻乐团 / ZUN 无关，是玩家自制工具。

## 致谢

- 动画素材与运行方式参考：[`PC2005-cloud/dsh-pet`](https://github.com/PC2005-cloud/dsh-pet)、[`MerZlin/dsh-pet-indesktop`](https://github.com/MerZlin/dsh-pet-indesktop)（MIT）
- 角色形象设计参考：「溟月」B 站 [@上善无形](https://space.bilibili.com/4456176)；DeepSeek 版女仆鲸鱼娘 [@ZipZipPipe](https://space.bilibili.com/4168597)
- 联机 mod：`sbrik1111/th07_multi_player`（CC0），反编译基础 `some100/th07`（CC0）
- 开发记录见 [docs/CHANGELOG-zh.md](docs/CHANGELOG-zh.md)
