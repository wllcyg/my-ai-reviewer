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
