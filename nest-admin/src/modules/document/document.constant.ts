/**
 * 企业级文档模块全局数据字典与状态机枚举定义
 * 单一真实来源 (Single Source of Truth, SSOT)
 */

export interface EnumOptionItem<T = string> {
  value: T;
  label: string;
  color?: string;
  badge?: "success" | "processing" | "default" | "error" | "warning";
  description?: string;
}

/** 1. 审批状态枚举 */
export enum ReviewStatusEnum {
  INIT = "INIT",
  AI_REVIEWING = "AI_REVIEWING",
  MANUAL_REVIEWING = "MANUAL_REVIEWING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export const REVIEW_STATUS_OPTIONS: Record<
  ReviewStatusEnum,
  EnumOptionItem<ReviewStatusEnum>
> = {
  [ReviewStatusEnum.INIT]: {
    value: ReviewStatusEnum.INIT,
    label: "草稿/未提交",
    color: "default",
    badge: "default",
    description: "刚完成直传，尚未进入审核",
  },
  [ReviewStatusEnum.AI_REVIEWING]: {
    value: ReviewStatusEnum.AI_REVIEWING,
    label: "AI 初审中",
    color: "processing",
    badge: "processing",
    description: "任务推送到 Python 引擎初审",
  },
  [ReviewStatusEnum.MANUAL_REVIEWING]: {
    value: ReviewStatusEnum.MANUAL_REVIEWING,
    label: "待人工复核",
    color: "warning",
    badge: "warning",
    description: "已提交审核，等待审核人人工复核",
  },
  [ReviewStatusEnum.APPROVED]: {
    value: ReviewStatusEnum.APPROVED,
    label: "审核通过",
    color: "success",
    badge: "success",
    description: "审核人或管理员人工审核通过",
  },
  [ReviewStatusEnum.REJECTED]: {
    value: ReviewStatusEnum.REJECTED,
    label: "已驳回",
    color: "error",
    badge: "error",
    description: "内容违规或被管理员拒绝",
  },
};

/** 2. 向量化状态枚举 (RAG) */
export enum VectorStatusEnum {
  UNPROCESSED = "unprocessed",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

export const VECTOR_STATUS_OPTIONS: Record<
  VectorStatusEnum,
  EnumOptionItem<VectorStatusEnum>
> = {
  [VectorStatusEnum.UNPROCESSED]: {
    value: VectorStatusEnum.UNPROCESSED,
    label: "未解析",
    badge: "default",
    color: "default",
    description: "尚未开始向量化切块",
  },
  [VectorStatusEnum.PROCESSING]: {
    value: VectorStatusEnum.PROCESSING,
    label: "切片向量化中",
    badge: "processing",
    color: "processing",
    description: "正在下载文件分块并生成 Embedding",
  },
  [VectorStatusEnum.COMPLETED]: {
    value: VectorStatusEnum.COMPLETED,
    label: "已就绪 (可检索)",
    badge: "success",
    color: "success",
    description: "向量已入库，可供 RAG 语义检索",
  },
  [VectorStatusEnum.FAILED]: {
    value: VectorStatusEnum.FAILED,
    label: "解析失败",
    badge: "error",
    color: "error",
    description: "文件格式受损或模型接口超时",
  },
};

/** 3. 文档生命周期状态 */
export enum DocumentStatusEnum {
  DRAFT = "DRAFT",
  UNDER_REVIEW = "UNDER_REVIEW",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
}

export const DOCUMENT_STATUS_OPTIONS: Record<
  DocumentStatusEnum,
  EnumOptionItem<DocumentStatusEnum>
> = {
  [DocumentStatusEnum.DRAFT]: {
    value: DocumentStatusEnum.DRAFT,
    label: "草稿",
    color: "default",
  },
  [DocumentStatusEnum.UNDER_REVIEW]: {
    value: DocumentStatusEnum.UNDER_REVIEW,
    label: "审核中",
    color: "processing",
  },
  [DocumentStatusEnum.PUBLISHED]: {
    value: DocumentStatusEnum.PUBLISHED,
    label: "已发布",
    color: "success",
  },
  [DocumentStatusEnum.ARCHIVED]: {
    value: DocumentStatusEnum.ARCHIVED,
    label: "已归档",
    color: "warning",
  },
};

/** 4. 可见范围权限枚举 */
export enum DocumentScopeEnum {
  PUBLIC = "PUBLIC",
  DEPT = "DEPT",
  PRIVATE = "PRIVATE",
}

export const DOCUMENT_SCOPE_OPTIONS: Record<
  DocumentScopeEnum,
  EnumOptionItem<DocumentScopeEnum>
> = {
  [DocumentScopeEnum.PUBLIC]: {
    value: DocumentScopeEnum.PUBLIC,
    label: "全员公开",
    color: "green",
    description: "公共知识库，全员均可查阅并检索",
  },
  [DocumentScopeEnum.DEPT]: {
    value: DocumentScopeEnum.DEPT,
    label: "部门内部",
    color: "blue",
    description: "仅指定部门成员拥有查阅及 RAG 语义检索权限",
  },
  [DocumentScopeEnum.PRIVATE]: {
    value: DocumentScopeEnum.PRIVATE,
    label: "私密文档",
    color: "purple",
    description: "仅创建者及特权管理员可见",
  },
};

/** 5. 内置默认分类字典 */
export const DOCUMENT_CATEGORY_OPTIONS: EnumOptionItem<string>[] = [
  { value: "技术规范", label: "技术规范", color: "blue" },
  { value: "安全合规", label: "安全合规", color: "red" },
  { value: "财务制度", label: "财务制度", color: "green" },
  { value: "人事行政", label: "人事行政", color: "orange" },
  { value: "产品说明", label: "产品说明", color: "purple" },
];

/** 管理员角色：可管理所有文档 */
export const DOCUMENT_ADMIN_ROLES: readonly string[] = ["admin", "super_admin"];

/** 审核人角色：可查看非草稿文档并执行审核（角色标识待与角色管理中的实际值保持一致） */
export const DOCUMENT_REVIEWER_ROLES: readonly string[] = ["reviewer"];

/** 6. 审批流节点与动作定义 */
export enum ApprovalNodeTypeEnum {
  SUBMIT = "SUBMIT",
  AI_REVIEW = "AI_REVIEW",
  MANUAL_REVIEW = "MANUAL_REVIEW",
}

export enum ApprovalActionEnum {
  SUBMIT = "SUBMIT",
  APPROVE = "APPROVE",
  REJECT = "REJECT",
  TRANSFER = "TRANSFER",
}
