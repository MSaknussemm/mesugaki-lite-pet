# 游戏侧补丁（可选）

这个目录**不包含任何游戏代码或游戏数据**，只有一个针对上游项目的补丁文件。

## 作用对象

[`sbrik1111/th07_multi_player`](https://github.com/sbrik1111/th07_multi_player)（CC0）——
让《东方妖妖梦》支持 2～3 人联机的实验性 mod，反编译基础是 [`some100/th07`](https://github.com/some100/th07)（CC0）。

## 补丁内容

`game-events.patch` 覆盖 17 个源文件：

1. **事件日志**：`PLAYER_HIT`、`PLAYER_DIE`、`STAGE_CLEAR`、`SPELL_START`、`SPELL_FAILED`、`BOSS_ENTER`、`ITEM_LIFE`、`ITEM_BOMB`、`POWER_FULL`、`POWER_LOW`、`DIALOGUE_START`、`GAME_OVER`
2. **Options 菜单越界修复**：窗口模式下 `colorMode16bit = 255` 会让 `vmHead[278]` 越界写堆（数组只有 164 个元素），补丁在 D3D 初始化时归一化，并在索引处做防御
3. **配置重置修复**：`Supervisor` 的校验不接受 255，而重置默认值又写 255，导致每次启动都判定 cfg 异常并清空玩家设置；补丁放行 255

## 应用方式

```bash
git clone https://github.com/sbrik1111/th07_multi_player
cd th07_multi_player
git apply -p1 /path/to/game-events.patch
python scripts/build.py        # 需要 MSVC v141 + Win10 SDK + DX8 SDK
```

已在上游原始 `src` 树上用 `git apply --check -p1` 验证可应用（exit 0）。

## 注意

- **不要分发 `th07.dat` / `thbgm.dat` / `th07.exe`**：上游 README 明确要求玩家自备正版游戏数据。
- 该 mod 是反编译产物，CC0 只代表作者对自身贡献的主张，不改变 ZUN / 上海爱丽丝幻乐团的权利。
- 本项目与上海爱丽丝幻乐团无关。
