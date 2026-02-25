# 在 ginko.fun/piggame 下访问

Vercel 按「路径」提供静态文件。要让游戏出现在 **ginko.fun/piggame**，需要把本游戏的代码放在主站仓库的 **piggame** 子目录里。

## 做法

1. **找到绑定 ginko.fun 的 Vercel 项目**（即主站仓库）。

2. **在主站仓库根目录下建一个 `piggame` 文件夹**，把本游戏这些内容原样放进去：
   - `index.html`
   - `style.css`
   - `game.js`
   - `assets/` 文件夹（内含 `pig_full.png`、`pig_blood.png`）

   主站目录结构示例：

   ```
   你的主站仓库/
   ├── index.html          （主站首页，可选）
   ├── 其他主站文件...
   └── piggame/
       ├── index.html
       ├── style.css
       ├── game.js
       └── assets/
           ├── pig_full.png
           └── pig_blood.png
   ```

3. **推送并部署**  
   push 到 Git 后，Vercel 会自动部署。访问 **https://ginko.fun/piggame/** 即可玩（末尾有无 `/` 均可）。

## 说明

- 本游戏里的路径都是相对路径（如 `style.css`、`assets/pig_full.png`），放在子目录下不需要改代码。
- 若主站根目录没有 `index.html`，可把 `piggame/index.html` 复制到根目录并改名为 `index.html` 作为主站首页，或单独做一个主站首页。
