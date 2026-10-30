import { Tag, Badge, Tooltip } from 'ant-design-vue';
import type { TableColumn } from '@/components/core/dynamic-table';

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

export const categoryOptions = [
  { label: '技术规范', value: '技术规范' },
  { label: '人事行政', value: '人事行政' },
  { label: '财务制度', value: '财务制度' },
  { label: '安全合规', value: '安全合规' },
  { label: '产品说明', value: '产品说明' },
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

export const vectorStatusOptions = [
  { label: '已就绪 (可检索)', value: 'completed' },
  { label: '切片向量化中', value: 'processing' },
  { label: '未解析', value: 'unprocessed' },
  { label: '解析失败', value: 'failed' },
];

export const reviewStatusOptions = [
  { label: '审核通过', value: 'APPROVED' },
  { label: 'AI 初审中', value: 'AI_REVIEWING' },
  { label: '待人工复核', value: 'MANUAL_REVIEWING' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '草稿/未提交', value: 'INIT' },
];

const categoryColorMap: Record<string, string> = {
  技术规范: 'blue',
  人事行政: 'orange',
  财务制度: 'green',
  安全合规: 'red',
  产品说明: 'purple',
};

export const getDocumentColumns = (actions: {
  onOpenReport: (record: DocumentItem) => void;
  onReVector: (record: DocumentItem) => void;
  onDelete: (record: DocumentItem) => void;
}): DocumentColumnItem[] => [
  {
    title: '文档名称与格式',
    dataIndex: 'title',
    width: 280,
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
    width: 130,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: '全部分类',
        options: categoryOptions,
        allowClear: true,
      },
    },
    customRender: ({ record }) => {
      return (
        <Tag color={categoryColorMap[record.category] || 'default'}>
          {record.category || '通用'}
        </Tag>
      );
    },
  },
  {
    title: '可见范围',
    dataIndex: 'scope',
    width: 170,
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
    title: '向量化状态 (RAG)',
    dataIndex: 'vectorStatus',
    width: 170,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: '全部状态',
        options: vectorStatusOptions,
        allowClear: true,
      },
    },
    customRender: ({ record }) => {
      const vs = record.vectorStatus;
      if (vs === 'completed' || vs === 'READY') {
        return <Badge status="success" text="已就绪 (可检索)" />;
      }
      if (vs === 'processing' || vs === 'PARSING') {
        return <Badge status="processing" text="正在分块切片..." />;
      }
      if (vs === 'failed' || vs === 'FAILED') {
        return <Badge status="error" text="解析失败" />;
      }
      return <Badge status="default" text="未解析" />;
    },
  },
  {
    title: 'AI 审核状态',
    dataIndex: 'reviewStatus',
    width: 180,
    formItemProps: {
      component: 'Select',
      componentProps: {
        placeholder: '全部状态',
        options: reviewStatusOptions,
        allowClear: true,
      },
    },
    customRender: ({ record }) => {
      const rs = record.reviewStatus;
      if (rs === 'APPROVED') {
        const scoreStr = record.reviewScore ? ` (${record.reviewScore}分)` : '';
        return <Tag color="success">审核通过{scoreStr}</Tag>;
      }
      if (rs === 'AI_REVIEWING' || rs === 'REVIEWING') {
        return <Tag color="processing">AI 初审中...</Tag>;
      }
      if (rs === 'MANUAL_REVIEWING') {
        return <Tag color="warning">待人工复核</Tag>;
      }
      if (rs === 'REJECTED') {
        return <Tag color="error">已驳回</Tag>;
      }
      return <Tag>草稿/未提交</Tag>;
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
      {
        label: '审核报告',
        type: 'link',
        onClick: () => actions.onOpenReport(record),
      },
      {
        label: '重新向量化',
        type: 'link',
        onClick: () => actions.onReVector(record),
      },
      {
        label: '删除',
        type: 'link',
        danger: true,
        popConfirm: {
          title: '确定要从知识库和文档库中彻底删除该文档吗？',
          onConfirm: () => actions.onDelete(record),
        },
      },
    ],
  },
];
