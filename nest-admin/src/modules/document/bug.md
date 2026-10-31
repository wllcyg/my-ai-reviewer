# DocumentModule 企业级规范分析报告

## 📊 总体评级：⭐⭐⭐⭐ (4/5) — 中高级企业规范

当前模块已具备企业级开发的**核心骨架**，在分层、类型安全和数据字典方面表现出色，但在一些细节上仍有提升空间。

---

## ✅ 做得好的地方

### 1. 模块组织结构 — 清晰规范

```
document/
├── document.module.ts          # 模块声明
├── document.controller.ts      # HTTP 路由入口
├── document.service.ts         # 业务逻辑层
├── document.entity.ts          # 主表 ORM 实体
├── document-approval.entity.ts # 审批流水实体
├── document.constant.ts        # 全局枚举 & 数据字典
├── r2-storage.service.ts       # R2 存储基础设施
└── dto/                        # 数据传输对象
    ├── create-document.dto.ts
    ├── query-document.dto.ts
    ├── query-approval.dto.ts
    ├── audit-document.dto.ts
    ├── document-meta.dto.ts
    └── upload-sign.dto.ts
```

> [!TIP]
> 遵循了 NestJS 官方推荐的 **Feature Module** 模式，每个领域模块自成一体，职责内聚。

### 2. SSOT 数据字典 — 企业级亮点

[document.constant.ts](file:///d:/self/my-ai-reviewer/nest-admin/src/modules/document/document.constant.ts) 的 `EnumOptionItem` 模式非常优秀：

```typescript
export interface EnumOptionItem<T = string> {
  value: T
  label: string
  color?: string
  badge?: 'success' | 'processing' | 'default' | 'error' | 'warning'
  description?: string
}
```

- ✅ 枚举值 + 显示标签 + UI 颜色 + 状态徽标一体化
- ✅ 前后端共享同一数据源，避免硬编码散落
- ✅ 通过 `/meta` 接口下发，前端零维护枚举映射

### 3. Controller 职责分离 — 符合规范

- Controller 仅做 HTTP 路由和参数接收，**不含任何业务逻辑**
- 使用 `@ApiTags` / `@ApiOperation` / `@ApiResult` 完善 Swagger 文档
- 使用 `@AuthUser()` 装饰器统一获取当前用户上下文
- 使用 `doc_code` 业务编码替代 DB `id` 暴露，**安全合规**

### 4. 实体设计 — 企业级水准

- 继承 `CompleteEntity` 自动拥有 `id` / `createdAt` / `updatedAt` / `createBy` / `updateBy`
- 列注释完备（`comment` 字段），对 DBA 友好
- 使用 `@Index()` 为高频查询字段建索引
- 字段命名遵循 `snake_case` 数据库列名 + `camelCase` TypeScript 属性的 ORM 惯例

### 5. 权限隔离 — 数据安全

```typescript
const isAdmin = user.roles?.includes('admin') || user.roles?.includes('super_admin')
if (!isAdmin) {
  qb.andWhere('(doc.scope = :pubScope OR (doc.scope = :privScope AND doc.create_by = :uid))')
}
```

- ✅ 列表查询和删除操作都做了数据权限过滤
- ✅ 非管理员用户只能操作自己的私密文档

---

## ⚠️ 需要改进的地方

### 1. 🔴 Service 层过于臃肿 — 违反 SRP

**问题**：[document.service.ts](file:///d:/self/my-ai-reviewer/nest-admin/src/modules/document/document.service.ts) 目前有 **392 行**，承担了过多职责：

| 职责 | 方法 |
|------|------|
| CRUD 基础操作 | `create`, `findAll`, `findByCode`, `deleteByCode` |
| 审批流业务 | `submitForReview`, `auditDocument` |
| 审批记录查询 | `findApprovalRecords` |
| 元数据字典 | `getMeta` |
| 存储代理 | `getUploadSignature`, `getDocumentAccessUrl` |

**企业级改进方案**：
```diff
document/
+ ├── services/
+ │   ├── document.service.ts         # 纯 CRUD + 查询
+ │   ├── document-approval.service.ts # 审批流转逻辑
+ │   └── document-meta.service.ts     # 字典 & 元数据
  ├── document.controller.ts
  └── ...
```

### 2. 🔴 权限检查逻辑重复散落

**问题**：`isAdmin` 判断逻辑在 Service 中重复出现了 **4 次**：

```typescript
// 出现在: findAll (L152), deleteByCode (L196), submitForReview (L229), findApprovalRecords (L374)
const isAdmin = user.roles && (user.roles.includes('admin') || user.roles.includes('super_admin'))
```

**企业级改进方案**：

```typescript
// 方案 A: 抽取为工具方法
private isAdminUser(user: IAuthUser): boolean {
  return user.roles?.includes('admin') || user.roles?.includes('super_admin') || false
}

// 方案 B: 更企业级 — 使用 NestJS Guard + CASL/RBAC
@UseGuards(RolesGuard)
@Roles('admin', 'super_admin')
```

### 3. 🟡 TypeORM 事务缺失 — 数据一致性风险

**问题**：`create` 和 `submitForReview` 方法中，文档保存和审批记录保存是 **两个独立的数据库操作**，没有包裹事务。如果第二步失败，数据会不一致。

```typescript
// document.service.ts L94-L107 — 两步操作未包事务
const savedDoc = await this.docRepo.save(doc) // 步骤1
await this.approvalRepo.save(initialApproval) // 步骤2 — 如果这里失败？
```

**企业级改进方案**：

```typescript
async create(dto: CreateDocumentDto, user: IAuthUser) {
  return this.docRepo.manager.transaction(async (manager) => {
    const doc = manager.create(DocumentEntity, { ... })
    const savedDoc = await manager.save(doc)
    const approval = manager.create(DocumentApprovalEntity, { ... })
    await manager.save(approval)
    return savedDoc
  })
}
```

### 4. 🟡 Entity 类型定义冗余

**问题**：[document.entity.ts](file:///d:/self/my-ai-reviewer/nest-admin/src/modules/document/document.entity.ts#L12-L15) 中的联合类型手动重复了枚举值：

```typescript
// 枚举值和字面量类型重复，维护成本高
export type DocumentStatus = DocumentStatusEnum | 'DRAFT' | 'UNDER_REVIEW' | 'PUBLISHED' | 'ARCHIVED'
```

**企业级改进**：直接使用枚举类型即可，无需手动展开字面量：

```typescript
export type DocumentStatus = `${DocumentStatusEnum}` // 模板字面量自动推导
```

### 5. 🟡 缺少输入验证管道

**问题**：Controller 中虽然使用了 DTO，但未看到全局或局部的 `ValidationPipe` 配合 `class-validator` 装饰器。

**企业级标配**：

```typescript
// main.ts 全局注册
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

// DTO 中使用装饰器
export class CreateDocumentDto {
  @IsString() @IsNotEmpty() @MaxLength(255)
  title: string
}
```

### 6. 🟡 返回类型使用 `any`

**问题**：[document.service.ts#L317](file:///d:/self/my-ai-reviewer/nest-admin/src/modules/document/document.service.ts#L317) 和 [document.controller.ts#L75](file:///d:/self/my-ai-reviewer/nest-admin/src/modules/document/document.controller.ts#L75) 中返回 `any[]`：

```typescript
// 不够类型安全
async findApprovalRecords(...): Promise<{ items: any[]; total: number }>
```

**改进**：定义明确的 VO/ResponseDto 类型。

### 7. 🟢 缺少单元测试文件

**问题**：整个 `document/` 目录下没有 `.spec.ts` 测试文件。企业级项目至少要有 Service 层的核心业务逻辑测试。

---

## 📋 改进优先级矩阵

| 优先级 | 问题 | 影响 | 工作量 |
|--------|------|------|--------|
| 🔴 P0 | 事务包裹 | 数据一致性 | 低 |
| 🔴 P0 | 权限逻辑抽取 | 可维护性 | 低 |
| 🟡 P1 | Service 拆分 | 可扩展性 | 中 |
| 🟡 P1 | 消除 `any` 类型 | 类型安全 | 低 |
| 🟡 P1 | 冗余类型声明 | DX 体验 | 低 |
| 🟢 P2 | 补充单元测试 | 质量保障 | 中 |
| 🟢 P2 | ValidationPipe 验证 | 安全性 | 低 |

---

## 🏁 结论

当前 `DocumentModule` 在 **架构分层、数据字典设计、实体建模、API 规范** 方面已经达到企业级水准。主要短板在于：

1. **事务安全** — 多表联动操作必须包裹事务
2. **代码复用** — 权限判断逻辑散落需要抽取
3. **Service 体量** — 随着业务增长应拆分为多个子 Service

> [!IMPORTANT]
> 以上 P0 级别的两个问题（事务 + 权限抽取）建议**立即修复**，它们是典型的"技术债积累点"，越早处理成本越低。
