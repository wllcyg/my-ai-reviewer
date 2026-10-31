<template>
  <div class="approval-record-wrapper p-4 bg-slate-50 min-h-full space-y-4">
    <!-- 1. 顶部概览指标看板 (浅色卡片质感) -->
    <a-row :gutter="16">
      <a-col :xs="24" :sm="12" :md="8">
        <div class="stat-card bg-white rounded-xl p-4 shadow-xs border border-slate-100 flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-500">流转审计日志总数</div>
            <div class="text-2xl font-bold text-slate-900 mt-1.5 flex items-baseline gap-1">
              {{ stats.totalLogs }} <span class="text-xs font-normal text-slate-400">条</span>
            </div>
            <div class="text-[11px] text-slate-400 mt-1">包含提交、AI 初审与人工复审节点</div>
          </div>
          <div class="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
            <HistoryOutlined />
          </div>
        </div>
      </a-col>

      <a-col :xs="24" :sm="12" :md="8">
        <div class="stat-card bg-white rounded-xl p-4 shadow-xs border border-slate-100 flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-500">审核通过累计</div>
            <div class="text-2xl font-bold text-emerald-600 mt-1.5 flex items-baseline gap-1">
              {{ stats.approvedCount }} <span class="text-xs font-normal text-slate-400">次</span>
            </div>
            <div class="text-[11px] text-emerald-600/80 mt-1">合规走查合格，已发布入库</div>
          </div>
          <div class="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
            <CheckCircleOutlined />
          </div>
        </div>
      </a-col>

      <a-col :xs="24" :sm="12" :md="8">
        <div class="stat-card bg-white rounded-xl p-4 shadow-xs border border-slate-100 flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-500">驳回修改累计</div>
            <div class="text-2xl font-bold text-rose-600 mt-1.5 flex items-baseline gap-1">
              {{ stats.rejectedCount }} <span class="text-xs font-normal text-slate-400">次</span>
            </div>
            <div class="text-[11px] text-rose-600/80 mt-1">退回创作者草稿箱修改</div>
          </div>
          <div class="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl">
            <CloseCircleOutlined />
          </div>
        </div>
      </a-col>
    </a-row>

    <!-- 2. 全局审批记录通用表格 -->
    <DynamicTable
      header-title="审批流转履历日志 (Audit Trail)"
      title-tooltip="记录全系统知识库文档提交、AI初审与人工复审的全生命周期轨迹"
      show-index
      :data-request="loadTableData"
      :columns="columns"
    />

    <!-- 3. 文档详情与审计全链条抽屉 -->
    <a-drawer
      v-model:open="detailDrawerVisible"
      title="文档详情与审批流转全景"
      width="600px"
      placement="right"
    >
      <div v-if="activeRecord" class="space-y-5">
        <!-- 基本属性 -->
        <a-descriptions title="文档核心属性" size="small" :column="2" bordered class="rounded-xl overflow-hidden">
          <a-descriptions-item label="文档标题" :span="2">{{ activeDocDetail?.title || activeRecord.docTitle || '未知文档' }}</a-descriptions-item>
          <a-descriptions-item label="业务编码" :span="2">
            <span class="font-mono text-xs text-slate-600">{{ activeRecord.docCode }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="所属类别">{{ activeDocDetail?.category || activeRecord.docCategory || '通用' }}</a-descriptions-item>
          <a-descriptions-item label="文件格式">{{ activeDocDetail?.fileType || activeRecord.docFileType || 'PDF' }}</a-descriptions-item>
          <a-descriptions-item label="当前状态">
            <a-tag color="blue">{{ activeDocDetail?.status || activeRecord.docStatus || 'UNKNOWN' }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="可见范围">{{ activeDocDetail?.scope || 'PUBLIC' }}</a-descriptions-item>
        </a-descriptions>

        <!-- 本次记录详情 -->
        <div class="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
          <div class="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>当前选中操作日志</span>
            <a-tag :color="activeRecord.action === 'APPROVE' ? 'success' : activeRecord.action === 'REJECT' ? 'error' : 'processing'">
              {{ activeRecord.action === 'APPROVE' ? '审核通过' : activeRecord.action === 'REJECT' ? '审核驳回' : '提交送审' }}
            </a-tag>
          </div>
          <div class="text-xs text-slate-500">操作人: {{ activeRecord.operatorName || '系统' }}</div>
          <div class="text-xs text-slate-500">操作时间: {{ activeRecord.createdAt ? activeRecord.createdAt.replace('T', ' ').substring(0, 16) : '未知' }}</div>
          <div class="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-2">
            <strong>审批意见：</strong> {{ activeRecord.comment || '无评语' }}
          </div>
        </div>

        <!-- 该文档的历史全流程 Timeline -->
        <div>
          <div class="font-medium text-slate-800 text-sm mb-3">该文档完整审批历史轨迹</div>
          <a-timeline v-if="docTimeline.length" class="mt-2 text-xs">
            <a-timeline-item
              v-for="(item, idx) in docTimeline"
              :key="idx"
              :color="item.action === 'APPROVE' ? 'green' : item.action === 'REJECT' ? 'red' : 'blue'"
            >
              <div class="font-semibold text-slate-700">
                {{ item.nodeType }} · {{ item.action }}
                <span class="font-normal text-slate-400 ml-2">
                  {{ item.createdAt ? item.createdAt.replace('T', ' ').substring(0, 16) : '' }}
                </span>
              </div>
              <div class="text-slate-500 mt-0.5">操作人: {{ item.operatorName || '系统' }}</div>
              <div class="text-slate-600 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                {{ item.comment || '无评语' }}
              </div>
            </a-timeline-item>
          </a-timeline>
          <div v-else class="text-xs text-slate-400 py-3 text-center">暂无更多历史记录</div>
        </div>
      </div>
    </a-drawer>
  </div>
</template>

<script lang="ts" setup>
  import { ref, reactive, computed } from 'vue';
  import {
    HistoryOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
  } from '@ant-design/icons-vue';
  import { useTable, type LoadDataParams } from '@/components/core/dynamic-table';
  import {
    documentApprovalRecordList,
    documentDetail,
    type ApprovalRecordItem,
  } from '@/api/backend/api/document';
  import { getApprovalColumns } from './columns';

  defineOptions({
    name: 'DocumentApprovalRecordList',
  });

  // 1. 初始化表格
  const [DynamicTable] = useTable({
    formProps: {
      autoSubmitOnEnter: true,
      labelWidth: 80,
      showAdvancedButton: false,
    },
  });

  // 2. 看板统计
  const stats = reactive({
    totalLogs: 0,
    approvedCount: 0,
    rejectedCount: 0,
  });

  // 3. 抽屉详情
  const detailDrawerVisible = ref(false);
  const activeRecord = ref<ApprovalRecordItem | null>(null);
  const activeDocDetail = ref<any>(null);
  const docTimeline = ref<any[]>([]);

  const handleOpenDocDetail = async (record: ApprovalRecordItem) => {
    activeRecord.value = record;
    activeDocDetail.value = null;
    docTimeline.value = [];
    detailDrawerVisible.value = true;

    try {
      if (record.docCode) {
        const res = await documentDetail(record.docCode);
        activeDocDetail.value = res?.document || null;
        docTimeline.value = res?.approvalHistory || [];
      }
    } catch (err) {
      console.warn('获取文档流转轨迹失败:', err);
    }
  };

  // 4. 表格列配置
  const columns = computed(() =>
    getApprovalColumns({
      onOpenDocDetail: handleOpenDocDetail,
    }),
  );

  // 5. 数据加载请求
  const loadTableData = async (params: LoadDataParams & Record<string, any>) => {
    const { keyword, action, dateRange, page = 1, pageSize = 10 } = params;

    let startDate: string | undefined;
    let endDate: string | undefined;
    if (Array.isArray(dateRange) && dateRange.length === 2) {
      startDate = dateRange[0];
      endDate = dateRange[1];
    }

    try {
      const res = await documentApprovalRecordList({
        page,
        pageSize,
        keyword,
        action,
        startDate,
        endDate,
      });

      const items = res?.items || [];
      const total = res?.total || 0;

      // 更新看板数据
      stats.totalLogs = total;
      stats.approvedCount = items.filter((i) => i.action === 'APPROVE').length;
      stats.rejectedCount = items.filter((i) => i.action === 'REJECT').length;

      return {
        items,
        total,
        page,
        pageSize,
      };
    } catch (err: any) {
      console.error('加载审批流转履历异常:', err);
      return {
        items: [],
        total: 0,
        page,
        pageSize,
      };
    }
  };
</script>

<style scoped>
  .stat-card {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .stat-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    transform: translateY(-1px);
  }
</style>
