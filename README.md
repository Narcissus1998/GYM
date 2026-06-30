# 碳循环训练饮食工具

当前版本已经升级为 React + Vite 项目，并按 Nike 参考体系重做了视觉语言与交互结构。

## 能力范围

- 人体参数输入与周碳循环策略生成
- 当前规则与参考表差异并排展示
- 高 / 中 / 低碳模板
- 7 天节奏编排
- 食物换算
- 餐次分配
- 本地保存计划
- 导出周计划 JSON

## 启动方式

```bash
npm install
npm run dev
```

构建生产版本：

```bash
npm run build
```

## 在线发布

仓库推到 GitHub 后，会通过 `.github/workflows/deploy.yml` 自动发布到 GitHub Pages。
默认监听 `master` 分支。

## 项目结构

- `src/App.jsx`：主界面与交互
- `src/styles.css`：Nike 风格视觉系统
- `src/lib/planner.js`：计算、导出、餐次分配
- `src/data/foods.js`：食物库
- `碳循环.xlsx`：原始参考工作簿

## 当前设计方向

- 配色与按钮语言参考 `DESIGN-nike.md`
- 大标题采用强对比运动海报式表达
- 主按钮统一为黑底白字胶囊按钮
- 内容区从“工具控制台”而不是“表格搬运”出发组织
