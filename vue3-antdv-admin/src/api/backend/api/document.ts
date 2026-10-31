import { request, type RequestOptions } from '@/utils/request';

export interface GenerateUploadSignParams {
  fileName: string;
  fileSize: number;
  contentType: string;
  category?: string;
  scope?: string;
}

export interface UploadSignResult {
  uploadUrl: string;
  storageKey: string;
  publicUrl: string;
  expiresIn: number;
}

export interface CreateDocumentParams {
  title: string;
  category?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storageKey: string;
  publicUrl?: string;
  scope?: 'PUBLIC' | 'DEPT' | 'PRIVATE';
  visibleDeptIds?: number[];
  visibleDeptNames?: string[];
}

export interface QueryDocumentParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  category?: string;
  status?: string;
  reviewStatus?: string;
  vectorStatus?: string;
  scope?: string;
}

export interface DocumentItemEntity {
  id: number;
  docCode: string;
  title: string;
  category?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storageKey: string;
  publicUrl?: string;
  scope: 'PUBLIC' | 'DEPT' | 'PRIVATE';
  visibleDeptIds?: number[];
  visibleDeptNames?: string[];
  status: string;
  reviewStatus: 'INIT' | 'AI_REVIEWING' | 'MANUAL_REVIEWING' | 'APPROVED' | 'REJECTED';
  reviewScore?: number;
  reviewRemark?: string;
  vectorStatus: 'unprocessed' | 'processing' | 'completed' | 'failed';
  createBy?: number;
  creator?: string;
  createdAt: string;
  updatedAt: string;
}

/** 获取文档直传 Cloudflare R2 预签名凭据 POST /api/documents/upload-sign */
export async function documentGetUploadSign(
  body: GenerateUploadSignParams,
  options?: RequestOptions,
) {
  return request<UploadSignResult>('/api/documents/upload-sign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 直传 R2 完成后提交落库保存 POST /api/documents */
export async function documentCreate(
  body: CreateDocumentParams,
  options?: RequestOptions,
) {
  return request<DocumentItemEntity>('/api/documents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 分页获取知识库文档列表 GET /api/documents */
export async function documentList(
  params?: QueryDocumentParams,
  options?: RequestOptions,
) {
  return request<{ items: DocumentItemEntity[]; total: number }>('/api/documents', {
    method: 'GET',
    params,
    ...(options || {}),
  });
}

/** 根据业务编码获取文档详情与审批流转历史 GET /api/documents/:code */
export async function documentDetail(
  code: string,
  options?: RequestOptions,
) {
  return request<{ document: DocumentItemEntity; approvalHistory: any[] }>(`/api/documents/${code}`, {
    method: 'GET',
    ...(options || {}),
  });
}

/** 根据业务编码删除文档及清理 R2 存储 DELETE /api/documents/:code */
export async function documentDelete(
  code: string,
  options?: RequestOptions,
) {
  return request<void>(`/api/documents/${code}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}

/** 提交文档审核（从草稿流转到待审核） POST /api/documents/:code/submit */
export async function documentSubmitReview(
  code: string,
  comment?: string,
  options?: RequestOptions,
) {
  return request<DocumentItemEntity>(`/api/documents/${code}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: { comment },
    ...(options || {}),
  });
}

/** 审核文档（通过/驳回） POST /api/documents/:code/audit */
export async function documentAudit(
  code: string,
  body: { action: 'APPROVE' | 'REJECT'; comment?: string },
  options?: RequestOptions,
) {
  return request<DocumentItemEntity>(`/api/documents/${code}/audit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取私密文档的授权预览访问链接 GET /api/documents/access-url */
export async function documentGetAccessUrl(
  params: { storageKey: string },
  options?: RequestOptions,
) {
  return request<string>('/api/documents/access-url', {
    method: 'GET',
    params,
    ...(options || {}),
  });
}

export interface DocumentMetaOption {
  value: string;
  label: string;
  color?: string;
  badge?: 'success' | 'processing' | 'default' | 'error' | 'warning';
  description?: string;
}

export interface DocumentMetaResult {
  reviewStatus: DocumentMetaOption[];
  vectorStatus: DocumentMetaOption[];
  documentStatus: DocumentMetaOption[];
  scope: DocumentMetaOption[];
  categories: DocumentMetaOption[];
}

/** 获取知识库文档模块全局枚举字典与配置元数据 (SSOT) GET /api/documents/meta */
export async function documentGetMeta(options?: RequestOptions) {
  return request<DocumentMetaResult>('/api/documents/meta', {
    method: 'GET',
    ...(options || {}),
  });
}

export interface QueryApprovalParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  action?: string;
  nodeType?: string;
  docCode?: string;
  startDate?: string;
  endDate?: string;
}

export interface ApprovalRecordItem {
  id: number;
  docId: number;
  docCode: string;
  nodeType: string;
  action: string;
  operatorId?: number;
  operatorName?: string;
  comment?: string;
  snapshotStatus?: string;
  createdAt: string;
  updatedAt: string;
  docTitle?: string;
  docCategory?: string;
  docFileType?: string;
  docFileSize?: number;
  docStatus?: string;
}

/** 分页获取全局审批流转履历列表 GET /api/documents/approval-records */
export async function documentApprovalRecordList(
  params?: QueryApprovalParams,
  options?: RequestOptions,
) {
  return request<{ items: ApprovalRecordItem[]; total: number }>('/api/documents/approval-records', {
    method: 'GET',
    params,
    ...(options || {}),
  });
}

