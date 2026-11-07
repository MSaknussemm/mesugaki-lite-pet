# 试用版验证

## 事件补充与吐舌更新（2026-11-07）

- 已补充 10 个缺失事件的源码触发点，并将 PLAYER_DIE 移到死炸窗口结束、确认掉命处；受击处改发 PLAYER_HIT。
- 游戏最终构建成功：57 个源文件，MSVC v141，输出已更新到原游戏 build 目录，并附副本于 game-integration。
- 对实际 Coop.cpp 中新增的辅助函数编译运行边界测试通过：满火力阈值、低火力阈值、未激活／已失败符卡抑制，以及不改变游戏状态。
- 桌宠 Node 自动测试 3 项通过，主程序语法检查通过。
- 隔离实例实测：临时 mp_log.txt 新增 STAGE_CLEAR → 播放 tongue（640×360，无解码错误）；SPELL_START 入队；队列最终清空并回到 idle。未修改真实游戏日志。
- 吐舌素材与桌面“盘腿打游戏-吐舌版.webm”哈希一致，12 秒；正式实例已重启并验证吐舌加载。
- 游戏自动回归尝试未能进入关卡：新版本的双人测试及修改前备份程序的基线测试都停在 Direct3D 初始化（trace 最后为 window_ok）。因此没有宣称 10 个场景均已在真实游戏中实测；需要在用户正常游戏环境中复验。

以下为早期试用版记录，源码与游戏已在上述更新中修改。

2026-11-07：

- 四段视频仅复制自桌面“盘腿打游戏”系列，SHA-256 与原文件逐一一致，每段 12 秒。
- 待机、说话、红温、坏笑均实际解码为 640×360，未报告视频错误。
- 实际窗口检查：透明角色、中文气泡可见；说话结束后恢复待机。
- 本机 POST 消息接口及串行播放通过；日志读取、半行、截断、新建文件、参数校验、通关与退出区分的自动测试通过（3 项）。
- Electron 45.2.3 运行时 ZIP 与其 npm 包内 SHA-256 清单核对一致。
- 禁用硬件加速后启动验证通过，避免此次遇到的图形缓存占用问题。

未完成实测：整局游戏的日志联动、独占全屏覆盖、多显示器拖动。游戏事件源代码和日志文件均未改动。

2026-11-07（晚，第二轮修复）：
- 启动补读只处理最近 5 分钟内修改的日志，并跳过 PAUSE / STAGE_START / SESSION_END / GAME_END，补读不再更新 lastGameEventAt。
- SESSION_END 纳入优先级（100）和冷却（3 秒）。
- 游戏端补 GAME_OVER 日志：进入 continue 画面时发 GAME_OVER，正常退出仍是 SESSION_END。
- 25% 不再隐藏气泡，字号下限降到 8px；气泡箭头拆到 overflow:visible 的外层。
- PLAYER_DIE 触发时移除队列里尚未播放的 PLAYER_HIT，减少同一次死亡连发。
- 空闲说话只在 gameRunning=false 时触发；STAGE_START 置 true，GAME_END/SESSION_END/GAME_OVER 置 false。
- 端口冲突写 pet.log；/health 返回 game_dir 和 serverError。
- zoom.log / idle.log 超过 100KB 自动清空。

2026-11-07（晚，置顶修复）：

- 窗口创建时 alwaysOnTop，并设 screen-saver 层级；新增 raiseTop()：启动、ready-to-show、show 以及每 2 秒重新 setAlwaysOnTop + moveTop；右键菜单弹出期间暂停，菜单关闭或 15 秒后恢复。
- 实测 z 序：桌宠始终为最上层可见窗口（索引 0）；最大化的记事本抢前台并等 8 秒后，桌宠仍是索引 0，且高于任务栏。
- 该机缩放 200%（物理 2880×1800，逻辑 1440×900）。桌宠窗口物理 960×960、逻辑 480×480；页面视口 960×960、devicePixelRatio 1，即 CSS 像素与物理像素 1:1，整页完整可见。
- 排查中的一次误判：未做 DPI 感知的截图进程只截到物理屏左上 1440×900 区域，看起来像"桌宠消失"；用 SetProcessDpiAwarenessContext(-4) 后全屏截图可见角色正常压在最大化的记事本之上（工作区 pet-topmost.png）。
- /health 新增 window 字段：bounds、content、scaleFactor、workArea，便于以后核对 DPI 与位置。
- 已知限制：独占全屏（D3D 独占交换链）会盖住任何置顶窗口；桌宠拖到任务栏上方时，与其重叠区域的任务栏点击会被窗口挡住。

2026-11-07（晚，台词精简）：

- 从 config.json 删除 13 个事件：PLAYER_HIT、SPELL_FAILED、BOT_SLOW、BOT_BOMB、BOT_DANGER、EXTEND、PLAYER_GIVE_POWER、POWER_GIVE、ITEM_LIFE、ITEM_BOMB、PAUSE、DIALOGUE_START、GRAZE_MILESTONE；原文件备份为 config.json.bak-20261107。
- 保留 21 个事件 × 3 句 + 6 句空闲台词 = 69 句。
- 删除后接口校验：PLAYER_HIT / BOT_BOMB / PAUSE 均返回 400（未知事件不再生成文本），PLAYER_DIE 返回 202；重启后队列为空、动画 idle 正常。
- 单句时长实测：气泡与动画 5.0 秒 + 0.6 秒收尾 = 5.6 秒，200ms 轮询测得 5.73 秒；空闲台词与菜单演示为 4.0 + 0.6 = 4.6 秒。默认值来自 core.js 的 `msg.duration_ms ?? 5000`。
- 游戏端日志未改动，被删事件仍会写入日志文件，只是桌宠不再响应。

2026-11-07（晚，7 秒与不排队）：

- `core.js` 默认时长 5000 → 7000；空闲台词与右键动画演示不再显式传 4000，统一走 7000。单句 = 7.0 秒气泡+动画 + 0.6 秒收尾 = 7.6 秒。
- `main.js` 的 `enqueue` 改为"忙则丢弃"：`busy || queue.length` 时返回 false，不再积压、不再按优先级重排；HTTP 接口同样返回 429（`正在说，说完再发`）。
- 实测：连续发送三句，第一句 202，后两句均 429；从第一句开始到队列清空实测 7.67 秒；播完后再次发送返回 202。
- 影响：播放期间的**游戏事件也会被丢弃**（不再排队），这是"没播完不接受新提示"的直接结果；冷却仍然生效，但丢弃的事件也会消耗对应冷却。

2026-11-07（晚，去掉救援事件并扩到 12 句）：

- 从 config.json 删除 GHOST_REVIVE、AUTO_REVIVE、LIFE_GIVE（被复活、自动送残、手动送残）；原配置备份为 config.json.bak-20261107-2。
- 剩余 18 个事件全部扩到 12 句，风格一致：BOT_DEATHBOMB、BOT_HIT、BOT_MISS、PLAYER_BOMB、PLAYER_DIE、GHOST、CONTINUE、POWER_FULL、POWER_LOW、STAGE_START、STAGE_CLEAR、BORDER_START、BORDER_END、SPELL_START、BOSS_ENTER、GAME_END、GAME_OVER、SESSION_END。
- 合计 18×12 + 6 句空闲 = 222 句。
- PLAYER_DIE 的 12 句中有 8 句明确写"靠自己/没人来救/本小姐的救援已经收了"，作为取消救援机制的补偿说明。
- 实测：GHOST_REVIVE / AUTO_REVIVE / LIFE_GIVE 均返回 400（未知事件）；PLAYER_DIE 连续 5 次均 202，每次间隔 8 秒等待播完，队列始终为 0。
- 未改动：游戏端日志仍会写这些事件，桌宠不再响应；idle-lines.txt 保持 6 句未扩写。

2026-11-07（晚，不常见事件只留一句）：

- POWER_LOW、GAME_END、GAME_OVER、CONTINUE、SESSION_END 各只保留 1 句，其余 13 个事件仍为 12 句；配置备份为 config.json.bak-20261107-3。
- 合计 13×12 + 5×1 + 6 = 167 句。
- 保留的句子：POWER_LOW「你火力呢？杂鱼。」、GAME_END「哼，过了。还行吧。」、GAME_OVER「团灭了，杂鱼。」、CONTINUE「行吧，本小姐陪你重来。」、SESSION_END「这局结束了。」
- 顺手修一处隐患：`processLine` 里 gameRunning 的置位原本排在"事件是否在 config 中"的检查之后，一旦某个结束类事件被删，gameRunning 会永远停在 true、空闲台词再也不触发。现在把 STAGE_START / GAME_END / SESSION_END / GAME_OVER 的状态更新提到检查之前。
- 实测：POWER_LOW、GAME_END、GAME_OVER、CONTINUE、SESSION_END、PLAYER_DIE 均返回 202；POWER_LOW 首次因上一句仍在播放返回 429，等待后重试 202，符合"播放中不接新台词"。
- 桌面文档（鲸鱼娘桌宠文档）已按新配置重新生成。

2026-11-07（晚，滚轮判定区两次减半）：

- 滚轮缩放判定椭圆：原来 `rx=w*0.16, ry=h*0.22`，先减半到 `0.08 / 0.11`，再减半到 `0.04 / 0.055`（renderer.js 的 wheel 处理）。
- 100% 缩放、窗口 480×480 时：半轴从 76.8×105.6 → 38.4×52.8 → **19.2×26.4**，外框约 **38×53 像素**。
- 判定中心固定在窗口 50% / 66% 高度，即角色身体位置；滚在气泡、窗口边缘、透明区域都不再触发缩放。
- 未改动的交互区域：拖动区仍是 `#drag`（left 34%、宽 33%、高 60%，贴底）；右键菜单仍响应整个窗口。窗口在系统层面依然占满 480×480 的矩形区域，透明部分也会接收鼠标，这与 CSS 判定区无关。

2026-11-07（晚，滚轮失效与右键报错修复）：

- 现象一：滚轮完全没用。原因不是椭圆太小，而是中心点写在 `cy = 0.66h`，落在角色头顶的空白区；角色身体实际在 0.84h 附近。改为 `cx = 0.51w, cy = 0.84h`，覆盖躯干。
- 现象二：缩到 25% 时椭圆只有 9.6×13.2 CSS 像素，等于没有。半径加下限 `max(30, w*0.04)` / `max(36, h*0.055)`。
- 现象三（用户截图）：右键菜单关闭时弹 "ReferenceError: raiseTop is not defined"。原因是 `raiseTop` 与 `menuOpen` 用 `let/function` 声明在 `app.whenReady().then()` 内部，而 `ipcMain.on('menu')` 的回调在模块顶层，作用域够不着；`menuOpen=true` 在非严格模式下偷偷创建了隐式全局所以没报，读到 `raiseTop` 才炸。已把两者提升到模块作用域。
- 兜底：`ipcMain.on('menu')` 整体 try/catch；新增 `process.on('uncaughtException'/'unhandledRejection')` 写 `pet.log`，不再弹 Electron 报错对话框。
- 各缩放下的判定半轴（本机 2× 屏，CSS 即物理像素）：25% → 30×36；50% → 30×36；75% → 30×40；100% → 38×53；125% → 48×66。
- 待用户确认：右键开合菜单不再弹窗；滚轮在角色身体上可用。

2026-11-07（晚，右键菜单关不掉导致"展示不好使"）：

- 现象：右键弹出菜单后，菜单**不会消失**——ESC 无效、点窗口外也无效，一直盖在角色身上，看起来像桌宠坏了。
- 原因：窗口是 `focusable:false`（不抢焦点），原生 `Menu.popup` 依附在这种窗口上拿不到激活，菜单不进入正常的"点击外部关闭 / ESC 关闭"流程。此前的 15 秒 `menuOpen` 计时只停了置顶抬升，并不会真的关菜单。
- 修法：`ipcMain.on('menu')` 里先 `win.setFocusable(true)`、`win.show()`、`win.focus()` 再 `popup`；关闭回调里恢复 `setFocusable(false)` 并重新 `raiseTop()`；重复右键先 `closePopup` 旧菜单；新增每 2 秒的兜底，菜单打开超过 10 秒强制关闭并写 `pet.log('menu stuck: force closed')`。
- 实测（三轮）：右键 → 等 0.9 秒 → ESC → 1.2 秒后截图，菜单全部消失，`pet.log` 无 stuck 记录；此前同样的操作会留下 `menu stuck` 日志。
- 菜单项可用性：键盘导航时 Enter 触发了「选择游戏目录」，弹出「选择文件夹」对话框，说明项点击链路正常；随后关闭对话框并重启桌宠。
- 副作用：仅在菜单打开期间窗口可被激活，关闭后立即恢复不可激活，不改变平时"不抢游戏焦点"的行为。

2026-11-07（晚，交付副本与构建目录清理）：

- `game-integration/th07_multi.exe` 更新为当前构建：复制 `build/th07_multi.exe`（21:07，修复后版本），两份 SHA-256 均为 `E4033835…DDD73D`；旧副本是 19:46 的修复前版本，用它恢复会把 Options 越界和配置重置带回来。
- `game-events.patch` 从上游 `sbrik1111/th07_multi_player` 的原始 `src` 重新生成（17 个文件，35,555 字节），补进 `GAME_OVER`，并包含两个本体 bug 的修复；在干净上游源码上 `git apply --check -p1` 通过（exit 0）。
- `game-integration/README.md` 删掉"GAME_OVER 未补充"的过时说明，补上 GAME_OVER 事件行、补丁来源与 exe 的 SHA-256。
- 删除 `build/mptest`（三份 17:51 的测试沙箱，各含一份 444MB 的 thbgm.dat）：build 目录 1.82 GB → 0.51 GB，释放 1.31 GB；删除前已确认没有任何 .cmd/.ps1/.ini 引用该目录。

