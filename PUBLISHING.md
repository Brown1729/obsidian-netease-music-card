# 上传与发布指南

本指南说明如何把项目上传到 GitHub、发布可安装版本，以及可选地提交到 Obsidian 社区插件市场。

## 1. 准备工作

确认本机已安装：

- [Git](https://git-scm.com/)
- Node.js 18 或更高版本
- 一个 GitHub 账号

本项目的本地 Git 仓库和初始提交已经创建。你只需要在 GitHub 上新建一个空仓库，然后推送。

## 2. 在 GitHub 创建空仓库

打开 GitHub，点击 **New repository**，建议填写：

- **Repository name**：`obsidian-netease-music-card`
- **Description**：`Paste NetEase Cloud Music links into Obsidian to create song cards with locally saved cover art.`
- **Visibility**：按需选择 Public 或 Private
- **Initialize this repository with**：不要勾选 README、.gitignore 或 license

创建后复制仓库的 HTTPS 地址，例如：

```
https://github.com/<你的 GitHub 用户名>/obsidian-netease-music-card.git
```

## 3. 设置提交身份并推送

先确认 Git 提交身份：

```bash
git config user.name "你的 GitHub 用户名"
git config user.email "你的 GitHub 邮箱"
```

> 本地初始提交使用了本机用户名 `29490` 作为作者。如果希望把这条提交改成你的身份，在推送前执行：
>
> ```bash
> git commit --amend --reset-author --no-edit
> ```

连接远程仓库并推送：

```bash
git remote add origin https://github.com/<你的 GitHub 用户名>/obsidian-netease-music-card.git
git branch -M main
git push -u origin main
```

如果之前已经添加过 `origin`，使用：

```bash
git remote set-url origin https://github.com/<你的 GitHub 用户名>/obsidian-netease-music-card.git
```

推送成功后，打开仓库页面确认源码、README 和 `.github/workflows` 都已经出现。

## 4. 发布第一个版本

### 方式一：GitHub Actions 自动发布（推荐）

项目已经包含 `.github/workflows/release.yml`。推送标签后，Actions 会自动：

1. 安装依赖。
2. 检查标签版本与 `manifest.json` 中的版本是否一致。
3. 构建 `main.js`。
4. 创建 GitHub Release，并附加 `main.js`、`manifest.json`、`styles.css`。

执行：

```bash
git tag 1.0.0
git push origin 1.0.0
```

然后到仓库的 **Actions** 页面查看 **Release** 工作流。完成后，**Releases** 页面会出现 `1.0.0`，用户可以直接下载三个安装文件。

### 方式二：手动发布

如果不想使用 Actions：

```bash
npm ci
npm run build
```

然后：

1. 在 GitHub 仓库右侧点击 **Releases → Draft a new release**。
2. 创建标签 `1.0.0`。
3. 上传以下三个文件：

   ```
   main.js
   manifest.json
   styles.css
   ```

4. 发布 Release。

> 标签名必须与 `manifest.json` 中的 `version` 一致。可以写成 `1.0.0` 或 `v1.0.0`，自动工作流会同时兼容这两种格式。

## 5. 发布后续版本

推荐使用 npm 的版本命令：

```bash
npm version patch   # 1.0.0 -> 1.0.1，适合修复 bug
npm version minor   # 1.0.0 -> 1.1.0，适合新增功能
npm version major   # 1.0.0 -> 2.0.0，适合破坏性变更
```

`npm version` 会自动执行 `version-bump.mjs`，更新：

- `package.json`
- `manifest.json`
- `versions.json`

并创建一次提交和一个版本标签。随后推送：

```bash
git push --follow-tags
```

标签推送后，GitHub Actions 会自动构建并发布新版本。

如果不使用 npm 命令，也可以手动修改 `manifest.json`、`package.json` 和 `versions.json` 中的版本号，提交后手动创建标签：

```bash
git tag 1.0.1
git push origin 1.0.1
```

## 6. 完善 GitHub 仓库信息

进入仓库的 **About** 设置，建议填写：

- **Description**：`Paste NetEase Cloud Music links into Obsidian to create song cards with locally saved cover art.`
- **Topics**：

  ```
  obsidian
  obsidian-plugin
  netease
  netease-music
  music
  markdown
  typescript
  ```

- **Website**：如果有 Obsidian 论坛帖子或使用说明页面，可以填写对应链接。

如果你希望 README 更直观，可以把一张实际使用截图保存为 `docs/preview.png`，然后在 README 的「效果」一节加入：

```markdown
![预览](docs/preview.png)
```

## 7. 通过 BRAT 分发

发布至少一个 Release 后，用户可以通过 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 安装：

```
<你的 GitHub 用户名>/obsidian-netease-music-card
```

BRAT 会读取仓库的 Release 文件，因此不需要把 `main.js` 提交到 Git 仓库。

## 8. 提交到 Obsidian 社区插件市场（可选）

社区市场对插件有额外要求。提交前请先阅读官方文档：

<https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin>

大致流程：

1. 确认仓库是公开的。
2. 确认已经发布至少一个 Release，并包含 `manifest.json`、`main.js`、`styles.css`。
3. Fork [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases)。
4. 在 `community-plugins.json` 中添加条目，格式参考该仓库当前已有插件：

   ```json
   {
     "id": "netease-music-card",
     "name": "NetEase Music Card",
     "author": "你的 GitHub 用户名",
     "description": "粘贴网易云音乐歌曲链接，生成带本地封面的歌曲卡片。",
     "repo": "你的 GitHub 用户名/obsidian-netease-music-card"
   }
   ```

5. 提交 Pull Request，并等待审核。

注意：插件 ID `netease-music-card` 在社区市场中必须唯一且不能随意修改，否则已安装用户无法正常更新。

## 9. 常见问题

### GitHub Actions 没有运行

- 确认 `.github/workflows/ci.yml` 和 `.github/workflows/release.yml` 已经推送到 `main` 分支。
- 打开 **Settings → Actions → General**，确认 Actions 已启用。
- 如果 Release 工作流没有创建 Release，检查 **Settings → Actions → General → Workflow permissions**，确保工作流有写入权限。仓库中的工作流已经声明 `permissions: contents: write`，但仓库策略仍可能覆盖它。

### 标签版本与 manifest 不一致

Release 工作流会检查标签和 `manifest.json` 的 `version`。例如标签是 `1.0.1`，但 `manifest.json` 仍然写着 `1.0.0`，工作流会失败。

解决方式是修改版本号并重新打标签：

```bash
git tag -d 1.0.1
git push origin :refs/tags/1.0.1
# 修改 manifest.json 后
git tag 1.0.1
git push origin 1.0.1
```

### Release 里没有 main.js

`main.js` 是构建产物，默认被 `.gitignore` 忽略。Release 工作流会先执行 `npm run build`，再把生成的文件上传到 Release。

如果希望把 `main.js` 直接提交到仓库，可以执行：

```bash
git add -f main.js
git commit -m "build: add compiled main.js"
```

但更推荐使用 Release + GitHub Actions 的方式，避免源码和构建产物不同步。

### npm ci 失败

确认 `package-lock.json` 已经提交到仓库，并且 Node.js 版本不低于 18。

## 10. 相关文件

- `.github/workflows/ci.yml`：每次推送和 PR 时执行类型检查和构建
- `.github/workflows/release.yml`：推送标签时自动构建并创建 Release
- `version-bump.mjs`：配合 `npm version` 更新版本号
- `manifest.json`：Obsidian 插件清单，版本号必须与 Release 标签一致
- `versions.json`：记录每个插件版本要求的最低 Obsidian 版本
