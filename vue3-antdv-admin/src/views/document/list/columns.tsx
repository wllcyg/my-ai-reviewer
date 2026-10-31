import { Tag, Badge, Tooltip } from 'ant-design-vue';
import type { TableColumn } from '@/components/core/dynamic-table';
import type { DocumentMetaResult } from '@/api/backend/api/document';

export interface DocumentItem {
  id: number;
  docCode?: string;
  title: string;
  fileName?: string;
  extension: 'pdf' | 'docx' | 'md' | 'txt' | string;
  category: string;
  deptName?: string;
  scope: 'PUBLIC' | 'DEPT' | 'PRIVATE';
  visibleDeptIds?: number[];
  visibleDeptNames?: string[];
  fileSize?: number;
  sizeStr: string;
  chunkCount: number;
  status: 'DRAFT' | 'UNDER_REVIEW' | 'PUBLISHED' | 'ARCHIVED' | string;
  vectorStatus: 'unprocessed' | 'processing' | 'completed' | 'failed' | string;
  reviewStatus: 'INIT' | 'AI_REVIEWING' | 'MANUAL_REVIEWING' | 'APPROVED' | 'REJECTED' | string;
  reviewScore: number;
  author: string;
  updatedAt: string;
  storageKey?: string;
  publicUrl?: string;
  issues?: Array<{
    line: number;
    type: string;
    level: 'HIGH' | 'MEDIUM' | 'LOW';
    snippet: string;
    suggestion: string;
  }>;
}

export type DocumentColumnItem = TableColumn<DocumentItem>;

/** 默认保底兜底分类 (未连通接口前或离线兜底) */
export const defaultCategoryOptions = [
  { label: '技术规范', value: '技术规范', color: 'blue' },
  { label: '安全合规', value: '安全合规', color: 'red' },
  { label: '财务制度', value: '财务制度', color: 'green' },
  { label: '人事行政', value: '人事行政', color: 'orange' },
  { label: '产品说明', value: '产品说明', color: 'purple' },
];

/** 用户可授权的管辖部门树结构 (支持多选) */
export const authorizedDeptTree = [
  {
    title: '技术中心 (总部)',
    value: 100,
    key: 100,
    children: [
      { title: '前端架构组', value: 101, key: 101 },
      { title: 'AI 研发与算法组', value: 102, key: 102 },
      { title: '运维与基础设施组', value: 103, key: 103 },
    ],
  },
  {
    title: '安全合规部',
    value: 200,
    key: 200,
    children: [
      { title: '数据安全组', value: 201, key: 201 },
      { title: '法务合规组', value: 202, key: 202 },
    ],
  },
  {
    title: '行政与财务中心',
    value: 300,
    key: 300,
    children: [
      { title: '财务部', value: 301, key: 301 },
      { title: 'HR 人力资源部', value: 302, key: 302 },
    ],
  },
];

export const defaultVectorStatusOptions = [
  { label: '已就绪 (可检索)', value: 'completed', badge: 'success' },
  { label: '切片向量化中', value: 'processing', badge: 'processing' },
  { label: '未解析', value: 'unprocessed', badge: 'default' },
  { label: '解析失败', value: 'failed', badge: 'error' },
];

export const defaultReviewStatusOptions = [
  { label: '审核通过', value: 'APPROVED', color: 'success' },
  { label: 'AI 初审中', value: 'AI_REVIEWING', color: 'processing' },
  { label: '待人工复核', value: 'MANUAL_REVIEWING', color: 'warning' },
  { label: '已驳回', value: 'REJECTED', color: 'error' },
  { label: '草稿/未提交', value: 'INIT', color: 'default' },
];

export const defaultDocumentStatusOptions = [
  { label: '草稿', value: 'DRAFT', color: 'default' },
  { label: '审核中', value: 'UNDER_REVIEW', color: 'processing' },
  { label: '已发布', value: 'PUBLISHED', color: 'success' },
  { label: '已归档', value: 'ARCHIVED', color: 'warning' },
];

export const getDocumentColumns = (actions: {
  onOpenReport?: (record: DocumentItem) => void;
  onSubmitReview: (record: DocumentItem) => void;
  onApprove: (record: DocumentItem) => void;
  onReject: (record: DocumentItem) => void;
  onReVector: (record: DocumentItem) => void;
  onDelete: (record: DocumentItem) => void;
  meta?: DocumentMetaResult | null;
}): DocumentColumnItem[] => {
  const categories = actions.meta?.categories?.length ? actions.meta.categories : defaultCategoryOptions;
  const vectorStatuses = actions.meta?.vectorStatus?.length ? actions.meta.vectorStatus : defaultVectorStatusOptions;
  const reviewStatuses = actions.meta?.reviewStatus?.length ? actions.meta.reviewStatus : defaultReviewStatusOptions;
  const documentStatuses = actions.meta?.documentStatus?.length ? actions.meta.documentStatus : defaultDocumentStatusOptions;

  return [
    {
      title: '文档名称与格式',
      dataIndex: 'title',
      searchField: 'keyword',
      width: 280,
      formItemProps: {
        label: '文档名称',
        component: 'Input',
        colProps: { span: 6 },
        componentProps: {
          placeholder: '输入文档名称搜索',
          allowClear: true,
        },
      },
      customRender: ({ record }) => {
      const ext = (record.extension || 'pdf').toLowerCase();
      let iconColor = 'bg-red-50 text-red-600 border-red-200';
      if (ext === 'docx' || ext === 'doc') {
        iconColor = 'bg-blue-50 text-blue-600 border-blue-200';
      } else if (ext === 'md' || ext === 'txt') {
        iconColor = 'bg-emerald-50 text-emerald-600 border-emerald-200';
      }

      return (
        <div class="flex items-center gap-3">
          <div
            class={`w-10 h-10 rounded-xl border flex flex-col items-center justify-center font-bold text-[11px] shrink-0 uppercase tracking-tighter ${iconColor}`}
          >
            <span>{ext}</span>
          </div>
          <div class="flex flex-col min-w-0">
            <span class="font-semibold text-slate-800 text-sm truncate hover:text-indigo-600 cursor-pointer transition-colors" title={record.title}>
              {record.title}
            </span>
            <span class="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>{record.sizeStr}</span>
              {record.chunkCount > 0 && (
                <>
                  <span class="text-slate-300">•</span>
                  <span>{record.chunkCount} 切片块</span>
                </>
              )}
            </span>
          </div>
        </div>
      );
    },
  },
  {
    title: '文档分类',
    dataIndex: 'category',
    width: 120,
    formItemProps: {
      label: '文档分类',
      colProps: { span: 6 },
      component: 'Select',
      componentProps: {
        placeholder: '全部分类',
        options: categories,
        allowClear: true,
      },
    },
    customRender: ({ record }) => {
      const found = categories.find((c) => c.value === record.category);
      return (
        <Tag color={found?.color || 'default'}>
          {found?.label || record.category || '通用'}
        </Tag>
      );
    },
  },
  {
    title: '文档状态',
    dataIndex: 'status',
    width: 110,
    formItemProps: {
      label: '文档状态',
      component: 'Select',
      colProps: { span: 6 },
      componentProps: {
        placeholder: '全部状态',
        options: documentStatuses,
        allowClear: true,
      },
    },
    customRender: ({ record }) => {
      const st = record.status || 'DRAFT';
      const found = documentStatuses.find((s) => s.value === st);
      return (
        <Tag color={found?.color || 'default'}>
          {found?.label || st}
        </Tag>
      );
    },
  },

  {
    title: '向量化状态 (RAG)',
    dataIndex: 'vectorStatus',
    width: 160,
    hideInSearch: true,
    customRender: ({ record }) => {
      const vs = record.vectorStatus;
      const found = vectorStatuses.find((v) => v.value === vs);
      if (found) {
        return <Badge status={(found.badge as any) || 'default'} text={found.label} />;
      }
      return <Badge status="default" text={vs || '未解析'} />;
    },
  },
  {
    title: '可见范围',
    dataIndex: 'scope',
    width: 150,
    hideInSearch: true,
    customRender: ({ record }) => {
      if (record.scope === 'PUBLIC') return <Tag color="green">全员公开</Tag>;
      if (record.scope === 'DEPT') {
        const deptNames = record.visibleDeptNames?.length
          ? record.visibleDeptNames.join('、')
          : record.deptName || '指定部门';
        const count = record.visibleDeptNames?.length || 1;
        return (
          <Tooltip title={`允许查看部门: ${deptNames}`}>
            <Tag color="blue" class="cursor-pointer">
              指定部门 ({count})
            </Tag>
          </Tooltip>
        );
      }
      return <Tag color="purple">私密文档</Tag>;
    },
  },
  {
    title: '更新人',
    dataIndex: 'author',
    width: 110,
    hideInSearch: true,
  },
  {
    title: '更新时间',
    dataIndex: 'updatedAt',
    width: 150,
    hideInSearch: true,
  },
  {
    title: '操作',
    width: 220,
    dataIndex: 'ACTION',
    hideInSearch: true,
    fixed: 'right',
    actions: ({ record }) => [
      ...(record.status === 'DRAFT'
        ? [
            {
              label: '提交审核',
              type: 'link' as const,
              popConfirm: {
                title: `确定要将《${record.title}》提交审核吗？提交后将进入待审核流转`,
                onConfirm: () => actions.onSubmitReview(record),
              },
            },
          ]
        : []),
      ...(record.status === 'UNDER_REVIEW'
        ? [
            {
              label: '通过',
              type: 'link' as const,
              popConfirm: {
                title: `确定要审核通过《${record.title}》并准予发布吗？`,
                onConfirm: () => actions.onApprove(record),
              },
            },
            {
              label: '驳回',
              type: 'link' as const,
              danger: true,
              onClick: () => actions.onReject(record),
            },
          ]
        : []),
      ...(record.status === 'PUBLISHED'
        ? [
            {
              label: '重新向量化',
              type: 'link' as const,
              onClick: () => actions.onReVector(record),
            },
          ]
        : []),
      {
        label: '删除',
        type: 'link' as const,
        danger: true,
        popConfirm: {
          title: '确定要从知识库和文档库中彻底删除该文档吗？',
          onConfirm: () => actions.onDelete(record),
        },
      },
    ],
  },
];
};
