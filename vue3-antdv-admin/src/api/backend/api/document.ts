import { request, baseApiUrl, type RequestOptions } from '@/utils/request';
import { accessToken } from '@/store/runtime';

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

/** 归档/下线文档（置为 ARCHIVED 状态并彻底从 RAG 检索池下架切块） POST /api/documents/:code/archive */
export async function documentArchive(
  code: string,
  options?: RequestOptions,
) {
  return request<DocumentItemEntity>(`/api/documents/${code}/archive`, {
    method: 'POST',
    ...(options || {}),
  });
}

/** 将已归档文档恢复为草稿状态（置为 DRAFT，允许重新编辑与再次提审） POST /api/documents/:code/unarchive */
export async function documentUnarchive(
  code: string,
  options?: RequestOptions,
) {
  return request<DocumentItemEntity>(`/api/documents/${code}/unarchive`, {
    method: 'POST',
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

/** 重新触发文档切片与多路衍生向量化管道 POST /api/documents/:code/re-vector */
export async function documentReVector(code: string, options?: RequestOptions) {
  return request<DocumentItemEntity>(`/api/documents/${code}/re-vector`, {
    method: 'POST',
    ...(options || {}),
  });
}

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface DocumentChatParams {
  query: string;
  history?: ChatHistoryItem[];
  docCode?: string;
  category?: string;
}

export interface CitationItem {
  docCode: string;
  title: string;
  headingPath?: string;
  score: number;
  snippet: string;
}

export interface DocumentChatResult {
  answer: string;
  citations: CitationItem[];
  costMs: number;
}

/** 知识库智能助手问答 POST /api/documents/chat */
export async function documentChat(data: DocumentChatParams, options?: RequestOptions) {
  return request<DocumentChatResult>('/api/documents/chat', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

export interface DocumentChatStreamHandlers {
  onStatus?: (status: { stage: string; text: string }) => void;
  onSources?: (sources: CitationItem[]) => void;
  onTextDelta?: (delta: string) => void;
  onReasoningDelta?: (text: string) => void;
  onFinish?: () => void;
  onError?: (err: Error) => void;
}

/** 知识库智能助手流式问答 POST /api/documents/chat/stream */
export async function documentChatStream(
  data: DocumentChatParams,
  handlers: DocumentChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const url = `${baseApiUrl || ''}/api/documents/chat/stream`;
  const token = accessToken.value;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
    signal,
  });

  if (!response.ok) {
    const errorMsg = `流式请求失败: HTTP ${response.status} ${response.statusText}`;
    handlers.onError?.(new Error(errorMsg));
    return;
  }

  if (!response.body) {
    handlers.onError?.(new Error('未接收到流式响应体'));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const dataPrefix = 'data: ';
        let payload = '';
        if (trimmed.startsWith(dataPrefix)) {
          payload = trimmed.slice(dataPrefix.length).trim();
        } else {
          const subLines = trimmed.split('\n');
          for (const sub of subLines) {
            if (sub.startsWith('data:')) {
              payload += sub.slice(5).trim();
            }
          }
        }

        if (payload === '[DONE]') {
          handlers.onFinish?.();
          return;
        }

        try {
          const event = JSON.parse(payload);
          if (event.type === 'data-status' && event.data) {
            handlers.onStatus?.(event.data);
          } else if (event.type === 'data-sources' && Array.isArray(event.data)) {
            handlers.onSources?.(event.data);
          } else if (event.type === 'text-delta' && event.delta) {
            handlers.onTextDelta?.(event.delta);
          } else if (event.type === 'reasoning-delta' && (event.text || event.delta)) {
            handlers.onReasoningDelta?.(event.text || event.delta);
          } else if (event.type === 'finish') {
            handlers.onFinish?.();
          } else if (event.type === 'error' && event.errorText) {
            handlers.onError?.(new Error(event.errorText));
          }
        } catch {
          // 非 JSON 数据行跳过
        }
      }
    }
    handlers.onFinish?.();
  } catch (err: any) {
    if (signal?.aborted) return;
    handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
  }
}




