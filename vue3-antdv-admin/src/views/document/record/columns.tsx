import { Tag, Tooltip } from 'ant-design-vue';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SendOutlined,
  RobotOutlined,
  UserOutlined,
} from '@ant-design/icons-vue';
import type { TableColumn } from '@/components/core/dynamic-table';
import type { ApprovalRecordItem } from '@/api/backend/api/document';

export type ApprovalColumnItem = TableColumn<ApprovalRecordItem>;

export const approvalActionOptions = [
  { label: '全部动作', value: '' },
  { label: '审核通过', value: 'APPROVE', color: 'success' },
  { label: '驳回修改', value: 'REJECT', color: 'error' },
  { label: '提交送审', value: 'SUBMIT', color: 'processing' },
];

export const approvalNodeTypeOptions = [
  { label: '全部节点', value: '' },
  { label: '人工复审', value: 'MANUAL_REVIEW' },
  { label: 'AI 合规初审', value: 'AI_REVIEW' },
  { label: '员工提交', value: 'SUBMIT' },
];

export const getApprovalColumns = (actions: {
  onOpenDocDetail: (record: ApprovalRecordItem) => void;
}): ApprovalColumnItem[] => {
  return [
    {
      title: '关联文档与业务编码',
      dataIndex: 'docTitle',
      searchField: 'keyword',
      width: 280,
      formItemProps: {
        label: '文档/关键词',
        component: 'Input',
        colProps: { span: 7 },
        componentProps: {
          placeholder: '输入文档标题、编码或操作人',
          allowClear: true,
        },
      },
      customRender: ({ record }) => {
        const ext = (record.docFileType || 'pdf').toLowerCase();
        let iconBg = 'bg-red-50 text-red-600 border-red-200';
        if (ext === 'docx' || ext === 'doc') {
          iconBg = 'bg-blue-50 text-blue-600 border-blue-200';
        } else if (ext === 'md' || ext === 'txt') {
          iconBg = 'bg-emerald-50 text-emerald-600 border-emerald-200';
        }

        return (
          <div class="flex items-center gap-3">
            <div
              class={`w-9 h-9 rounded-xl border flex flex-col items-center justify-center font-bold text-[10px] shrink-0 uppercase tracking-tight ${iconBg}`}
            >
              <span>{ext}</span>
            </div>
            <div class="flex flex-col min-w-0">
              <span
                class="font-semibold text-slate-800 text-sm truncate hover:text-indigo-600 cursor-pointer transition-colors"
                title={record.docTitle || record.docCode}
                onClick={() => actions.onOpenDocDetail(record)}
              >
                {record.docTitle || '未知文档'}
              </span>
              <span class="text-xs text-slate-400 mt-0.5">
                <span class="font-mono">{record.docCode}</span>
                {record.docCategory && (
                  <>
                    <span class="mx-1.5 text-slate-300">•</span>
                    <span>{record.docCategory}</span>
                  </>
                )}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      title: '审批动作',
      dataIndex: 'action',
      width: 130,
      formItemProps: {
        label: '审批结论',
        component: 'Select',
        colProps: { span: 5 },
        componentProps: {
          placeholder: '全部结论',
          options: [
            { label: '审核通过', value: 'APPROVE' },
            { label: '驳回修改', value: 'REJECT' },
            { label: '提交送审', value: 'SUBMIT' },
          ],
          allowClear: true,
        },
      },
      customRender: ({ record }) => {
        const act = record.action;
        if (act === 'APPROVE') {
          return (
            <Tag color="success" class="flex items-center gap-1 w-fit">
              <CheckCircleOutlined />
              <span>审核通过</span>
            </Tag>
          );
        }
        if (act === 'REJECT') {
          return (
            <Tag color="error" class="flex items-center gap-1 w-fit">
              <CloseCircleOutlined />
              <span>驳回修改</span>
            </Tag>
          );
        }
        return (
          <Tag color="processing" class="flex items-center gap-1 w-fit">
            <SendOutlined />
            <span>提交送审</span>
          </Tag>
        );
      },
    },
    {
      title: '流程节点',
      dataIndex: 'nodeType',
      width: 130,
      hideInSearch: true,
      customRender: ({ record }) => {
        const nt = record.nodeType;
        if (nt === 'MANUAL_REVIEW') {
          return <span class="text-xs font-medium text-slate-700">人工复审节点</span>;
        }
        if (nt === 'AI_REVIEW') {
          return (
            <span class="text-xs font-medium text-indigo-600 flex items-center gap-1">
              <RobotOutlined /> AI 走查初审
            </span>
          );
        }
        return <span class="text-xs text-slate-500">创作者提交</span>;
      },
    },
    {
      title: '操作人',
      dataIndex: 'operatorName',
      width: 120,
      hideInSearch: true,
      customRender: ({ record }) => {
        const isAi = record.nodeType === 'AI_REVIEW' || record.operatorName?.toLowerCase().includes('ai');
        return (
          <div class="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
            {isAi ? (
              <RobotOutlined class="text-indigo-500" />
            ) : (
              <UserOutlined class="text-slate-400" />
            )}
            <span>{record.operatorName || (isAi ? 'AI 审核引擎' : '系统操作员')}</span>
          </div>
        );
      },
    },
    {
      title: '审批意见 / 修改指引',
      dataIndex: 'comment',
      width: 280,
      hideInSearch: true,
      customRender: ({ record }) => {
        const c = record.comment || '无评语';
        return (
          <Tooltip title={c}>
            <div class="text-xs text-slate-600 truncate bg-slate-50/80 px-2.5 py-1 rounded border border-slate-100 max-w-[260px]">
              {c}
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: '当时状态快照',
      dataIndex: 'snapshotStatus',
      width: 120,
      hideInSearch: true,
      customRender: ({ record }) => {
        const snap = record.snapshotStatus || 'UNKNOWN';
        if (snap === 'PUBLISHED') return <Tag color="green">已发布</Tag>;
        if (snap === 'UNDER_REVIEW') return <Tag color="orange">待审核</Tag>;
        if (snap === 'DRAFT') return <Tag color="default">草稿箱</Tag>;
        return <Tag color="blue">{snap}</Tag>;
      },
    },
    {
      title: '流转记录时间',
      dataIndex: 'createdAt',
      width: 160,
      searchField: 'dateRange',
      formItemProps: {
        label: '操作时间',
        component: 'RangePicker',
        colProps: { span: 8 },
        componentProps: {
          placeholder: ['起始日期', '截止日期'],
          valueFormat: 'YYYY-MM-DD',
        },
      },
      customRender: ({ record }) => {
        const time = record.createdAt ? record.createdAt.replace('T', ' ').substring(0, 16) : '刚刚';
        return <span class="text-xs text-slate-500">{time}</span>;
      },
    },
    {
      title: '操作',
      width: 120,
      dataIndex: 'ACTION',
      hideInSearch: true,
      fixed: 'right',
      actions: ({ record }) => [
        {
          label: '查看文档',
          type: 'link',
          onClick: () => actions.onOpenDocDetail(record),
        },
      ],
    },
  ];
};
