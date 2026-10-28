import { Tag, Badge } from 'ant-design-vue';
import type { TableColumn } from '@/components/core/dynamic-table';

export interface DocumentItem {
  id: number;
  title: string;
  extension: 'pdf' | 'docx' | 'md' | 'txt' | string;
  category: string;
  deptName: string;
  scope: 'PUBLIC' | 'DEPT' | 'PRIVATE';
  sizeStr: string;
  chunkCount: number;
  vectorStatus: 'READY' | 'PARSING' | 'FAILED' | 'PENDING';
  reviewStatus: 'APPROVED' | 'REVIEWING' | 'REJECTED' | 'PENDING';
  reviewScore: number;
  author: string;
  updatedAt: string;
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

export const vectorStatusOptions = [
  { label: '已就绪 (可检索)', value: 'READY' },
  { label: '分块切片中 (PARSING)', value: 'PARSING' },
  { label: '未解析 (PENDING)', value: 'PENDING' },
  { label: '解析失败 (FAILED)', value: 'FAILED' },
];

export const reviewStatusOptions = [
  { label: '审核通过', value: 'APPROVED' },
  { label: 'AI 走查中', value: 'REVIEWING' },
  { label: '存在违规风险', value: 'REJECTED' },
  { label: '待审核', value: 'PENDING' },
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
    title: '文档名称',
    dataIndex: 'title',
    width: 320,
    searchField: 'keyword',
    formItemProps: {
      component: 'Input',
      componentProps: {
        placeholder: '输入文档标题或关键字搜索',
        allowClear: true,
      },
    },
    customRender: ({ record }) => {
      const extClass = `ext-${record.extension.toLowerCase()}`;
      return (
        <div class="flex items-center gap-2.5">
          <span class={`file-ext-tag ${extClass}`}>
            {record.extension.toUpperCase()}
          </span>
          <div>
            <a
              class="font-medium text-slate-900 hover:text-blue-600 transition-colors"
              onClick={() => actions.onOpenReport(record)}
            >
              {record.title}
            </a>
            <div class="text-xs text-slate-400 mt-0.5">
              大小: {record.sizeStr} · {record.chunkCount} 个切片向量
            </div>
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
          {record.category}
        </Tag>
      );
    },
  },
  {
    title: '可见范围',
    dataIndex: 'scope',
    width: 140,
    hideInSearch: true,
    customRender: ({ record }) => {
      if (record.scope === 'PUBLIC') return <Tag color="green">全员公开</Tag>;
      if (record.scope === 'DEPT') return <Tag color="blue">部门内部 ({record.deptName})</Tag>;
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
      if (record.vectorStatus === 'READY') {
        return <Badge status="success" text="已就绪 (可检索)" />;
      }
      if (record.vectorStatus === 'PARSING') {
        return <Badge status="processing" text="正在分块切片..." />;
      }
      if (record.vectorStatus === 'FAILED') {
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
      if (record.reviewStatus === 'APPROVED') {
        return <Tag color="success">审核通过 ({record.reviewScore}分)</Tag>;
      }
      if (record.reviewStatus === 'REVIEWING') {
        return <Tag color="processing">AI 走查中...</Tag>;
      }
      if (record.reviewStatus === 'REJECTED') {
        return <Tag color="error">存在违规风险</Tag>;
      }
      return <Tag>待审核</Tag>;
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
