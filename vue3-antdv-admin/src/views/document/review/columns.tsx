import { Tag } from 'ant-design-vue';
import type { TableColumn } from '@/components/core/dynamic-table';
import type { DocumentItem } from '../list/columns';
import type { DocumentMetaResult } from '@/api/backend/api/document';
import { defaultCategoryOptions, defaultReviewStatusOptions } from '../list/columns';

export type ReviewColumnItem = TableColumn<DocumentItem>;

export const getReviewColumns = (actions: {
  onOpenReport: (record: DocumentItem) => void;
  onApprove: (record: DocumentItem) => void;
  onReject: (record: DocumentItem) => void;
  meta?: DocumentMetaResult | null;
}): ReviewColumnItem[] => {
  const categories = actions.meta?.categories?.length ? actions.meta.categories : defaultCategoryOptions;
  const reviewStatuses = actions.meta?.reviewStatus?.length ? actions.meta.reviewStatus : defaultReviewStatusOptions;

  return [
    {
      title: '待审核文档名称',
      dataIndex: 'title',
      searchField: 'keyword',
      width: 260,
      formItemProps: {
        label: '文档名称',
        component: 'Input',
        colProps: { span: 6 },
        componentProps: {
          placeholder: '输入文档标题或提交人搜索',
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
              <span
                class="font-semibold text-slate-800 text-sm truncate hover:text-indigo-600 cursor-pointer transition-colors"
                title={record.title}
                onClick={() => actions.onOpenReport(record)}
              >
                {record.title}
              </span>
              <span class="text-xs text-slate-400 mt-0.5">
                <span>{record.sizeStr}</span>
                <span class="ml-2 text-slate-300">•</span>
                <span class="ml-2 text-slate-500 font-medium">业务编号: {record.docCode}</span>
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
        return <Tag color={found?.color || 'default'}>{found?.label || record.category || '通用'}</Tag>;
      },
    },
    {
      title: '提交人',
      dataIndex: 'author',
      width: 110,
      hideInSearch: true,
      customRender: ({ record }) => <span class="font-medium text-slate-700">{record.author}</span>,
    },
    {
      title: '提交时间',
      dataIndex: 'updatedAt',
      width: 150,
      hideInSearch: true,
    },
    {
      title: 'AI 初审结论',
      dataIndex: 'reviewStatus',
      width: 160,
      hideInSearch: true,
      customRender: ({ record }) => {
        const rs = record.reviewStatus;
        const found = reviewStatuses.find((r) => r.value === rs);
        const scoreStr = record.reviewScore ? ` (${record.reviewScore}分)` : '';
        return (
          <Tag color={found?.color || 'default'}>
            {found?.label || rs || '待初审'}{scoreStr}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      width: 200,
      dataIndex: 'ACTION',
      hideInSearch: true,
      fixed: 'right',
      actions: ({ record }) => [
        {
          label: '走查报告',
          type: 'link',
          onClick: () => actions.onOpenReport(record),
        },
        {
          label: '通过',
          type: 'link',
          popConfirm: {
            title: `确定通过《${record.title}》的审核并予以发布吗？`,
            onConfirm: () => actions.onApprove(record),
          },
        },
        {
          label: '驳回',
          type: 'link',
          danger: true,
          onClick: () => actions.onReject(record),
        },
      ],
    },
  ];
};
