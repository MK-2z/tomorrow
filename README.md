# v21 功能修复包 - 审查流程与导出优化

## 修复内容

### 1. 导出评价记录时原因格不备注证明材料
- 文件：`client/src/utils/export-excel.ts`
- 修改：移除导出Excel时原因列中的证明材料文件名备注
- 原因：证明材料通过单独的ZIP导出，Excel中不需要重复显示

### 2. 学生登录后不自动填写班级姓名学号
- 文件：`client/src/pages/quality-eval/QualityEvalPage.tsx`
- 修改：注释掉学生身份自动预填身份信息的逻辑
- 效果：学生登录后评价表单的班级、姓名、学号字段全部留空，可手动编辑

### 3. 导出功能仅超级管理员可见可用
- 文件：`client/src/pages/review-list/ReviewListPage.tsx`
- 修改：导出按钮区域已被 `isSuperAdmin` 条件包裹
- 效果：学生和普通管理员看不到导出按钮，只有超级管理员能导出

### 4. 导出评价记录和证明材料都必须先选中
- 文件：`client/src/pages/review-list/ReviewListPage.tsx`
- 修改：
  - 移除"导出全部"按钮
  - "导出评价记录"按钮添加 `disabled={exporting || selectedIds.size === 0}`
  - "导出证明材料"按钮添加 `disabled={exporting || selectedIds.size === 0}`
  - "导出证明材料"改为只导出选中的记录（之前是导出全部筛选结果）
- 效果：未选中任何记录时，导出按钮为灰色不可点击

### 5. 审查打回流程修复
- 文件：`server/modules/quality-eval/quality-eval.service.ts`
- 修改：`reviewItem` 方法中，当标记单个指标为"待修改"时，不改变整体记录状态
- 效果：
  - 管理员标记某些指标为"待修改"只是标记，整体记录状态不变
  - 管理员需要点击"打回"按钮，整体状态才变为"待修改/打回"
  - 学生只有在整体状态为"待修改"时才能修改并重新提交

## 使用方法

1. 将本压缩包中的文件按目录结构复制到项目根目录，覆盖原有文件
2. 提交到 GitHub
3. Railway 会自动重新构建部署

## 文件清单

```
v21-fix/
├── client/
│   └── src/
│       ├── utils/
│       │   └── export-excel.ts
│       └── pages/
│           ├── quality-eval/
│           │   └── QualityEvalPage.tsx
│           └── review-list/
│               └── ReviewListPage.tsx
└── server/
    └── modules/
        └── quality-eval/
            └── quality-eval.service.ts
```
