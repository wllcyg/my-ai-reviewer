<template>
  <div class="review-page-wrapper p-4 bg-slate-50 min-h-full space-y-4">
    <!-- 1. 顶部审核中心概览看板 -->
    <a-row :gutter="16">
      <a-col :xs="24" :sm="12" :md="8">
        <div class="stat-card bg-white rounded-xl p-4 shadow-xs border border-slate-100 flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-500">待人工复审总数</div>
            <div class="text-2xl font-bold text-amber-600 mt-1.5 flex items-baseline gap-1">
              {{ pendingTotal }} <span class="text-xs font-normal text-slate-400">篇</span>
            </div>
            <div class="text-[11px] text-slate-400 mt-1">需合规员把关后准予发布</div>
          </div>
          <div class="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl">
            <ClockCircleOutlined />
          </div>
        </div>
      </a-col>

      <a-col :xs="24" :sm="12" :md="8">
        <div class="stat-card bg-white rounded-xl p-4 shadow-xs border border-slate-100 flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-500">AI 预警疑似风险</div>
            <div class="text-2xl font-bold text-rose-600 mt-1.5 flex items-baseline gap-1">
              {{ riskAlertTotal }} <span class="text-xs font-normal text-slate-400">篇标记</span>
            </div>
            <div class="text-[11px] text-rose-600/80 mt-1">走查模型识别出潜在敏感项</div>
          </div>
          <div class="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl">
            <AlertOutlined />
          </div>
        </div>
      </a-col>

      <a-col :xs="24" :sm="12" :md="8">
        <div class="stat-card bg-white rounded-xl p-4 shadow-xs border border-slate-100 flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-500">AI 初审平均得分</div>
            <div class="text-2xl font-bold text-indigo-600 mt-1.5 flex items-baseline gap-1">
              {{ avgScore }} <span class="text-xs font-normal text-slate-400">分</span>
            </div>
            <div class="text-[11px] text-indigo-600/80 mt-1">基于安全、合规与技术制度走查</div>
          </div>
          <div class="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
            <SafetyCertificateOutlined />
          </div>
        </div>
      </a-col>
    </a-row>

    <!-- 2. 待审核文档列表通用表格 -->
    <DynamicTable
      header-title="待审核文档工作台"
      title-tooltip="集中处理员工提交的草稿文档，结合 AI 预审报告进行快速审批与驳回"
      show-index
      :data-request="loadTableData"
      :columns="columns"
    />

    <!-- 3. 驳回意见输入对话框 -->
    <a-modal
      v-model:open="rejectModalVisible"
      title="驳回文档审核"
      ok-text="确认驳回"
      cancel-text="取消"
      ok-type="danger"
      @ok="handleConfirmReject"
    >
      <div class="space-y-3 py-2">
        <div class="text-xs text-slate-500">
          驳回后，文档将退回至草稿状态，提交人可根据您的修改意见重新编辑并再次提交。
        </div>
        <a-textarea
          v-model:value="rejectComment"
          placeholder="请输入详细的驳回原因或修改指引（必填）"
          :rows="4"
          :maxlength="300"
          show-count
        />
      </div>
    </a-modal>

    <!-- 4. AI 走查走访抽屉与流转历史 -->
    <a-drawer
      v-model:open="reportDrawerVisible"
      title="文档审核与 AI 走查详情"
      width="600px"
      placement="right"
    >
      <div v-if="activeReportDoc" class="space-y-5">
        <!-- 审核得分与结论看板 -->
        <div
          class="p-4 rounded-xl flex items-center justify-between border"
          :class="(activeReportDoc.reviewScore || 0) >= 80 ? 'bg-emerald-50/70 border-emerald-100' : 'bg-amber-50/70 border-amber-100'"
        >
          <div>
            <div class="text-xs text-slate-500">AI 综合合规走查评分</div>
            <div
              class="text-2xl font-bold mt-1"
              :class="(activeReportDoc.reviewScore || 0) >= 80 ? 'text-emerald-600' : 'text-amber-600'"
            >
              {{ activeReportDoc.reviewScore || 0 }} 分
            </div>
            <div class="text-xs mt-1 text-slate-600">
              初步建议：{{ (activeReportDoc.reviewScore || 0) >= 80 ? '合规规范良好，准予通过' : '发现潜在风险项，建议仔细复核' }}
            </div>
          </div>
          <div class="text-3xl">
            <CheckCircleOutlined v-if="(activeReportDoc.reviewScore || 0) >= 80" class="text-emerald-500" />
            <AlertOutlined v-else class="text-amber-500" />
          </div>
        </div>

        <!-- 基本信息概览 -->
        <a-descriptions title="文档基本属性" size="small" :column="2" bordered class="rounded-xl overflow-hidden">
          <a-descriptions-item label="文档名称" :span="2">{{ activeReportDoc.title }}</a-descriptions-item>
          <a-descriptions-item label="所属类别">{{ activeReportDoc.category }}</a-descriptions-item>
          <a-descriptions-item label="提交人">{{ activeReportDoc.author }}</a-descriptions-item>
          <a-descriptions-item label="文件大小">{{ activeReportDoc.sizeStr }}</a-descriptions-item>
          <a-descriptions-item label="权限范围">{{ activeReportDoc.scope }}</a-descriptions-item>
        </a-descriptions>

        <!-- 审核流转审批历史 (从后端真实接口拉取) -->
        <div>
          <div class="font-medium text-slate-800 text-sm mb-3">审批流转历程轨迹 (Audit Trail)</div>
          <a-timeline v-if="approvalHistory.length" class="mt-2 text-xs">
            <a-timeline-item
              v-for="(log, idx) in approvalHistory"
              :key="idx"
              :color="log.action === 'APPROVE' ? 'green' : log.action === 'REJECT' ? 'red' : 'blue'"
            >
              <div class="font-semibold text-slate-700">
                {{ log.nodeType }} · {{ log.action }}
                <span class="font-normal text-slate-400 ml-2">{{ log.createdAt ? log.createdAt.replace('T', ' ').substring(0, 16) : '' }}</span>
              </div>
              <div class="text-slate-500 mt-0.5">操作人: {{ log.operatorName || '系统' }}</div>
              <div class="text-slate-600 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                {{ log.comment || '无评语' }}
              </div>
            </a-timeline-item>
          </a-timeline>
          <div v-else class="text-xs text-slate-400 py-3 text-center">暂无更多历史记录</div>
        </div>

        <!-- 底部快捷审批按钮栏 -->
        <div class="pt-4 border-t flex justify-end gap-3">
          <a-button danger @click="openRejectModal(activeReportDoc)">驳回修改</a-button>
          <a-button type="primary" @click="handleDrawerApprove">审核通过并发布</a-button>
        </div>
      </div>
    </a-drawer>
  </div>
</template>

<script lang="ts" setup>
  import { ref, computed, onMounted } from 'vue';
  import { message } from 'ant-design-vue';
  import {
    ClockCircleOutlined,
    AlertOutlined,
    SafetyCertificateOutlined,
    CheckCircleOutlined,
  } from '@ant-design/icons-vue';
  import { useTable, type LoadDataParams } from '@/components/core/dynamic-table';
  import {
    documentList,
    documentAudit,
    documentDetail,
    documentGetMeta,
    type DocumentMetaResult,
  } from '@/api/backend/api/document';
  import type { DocumentItem } from '../list/columns';
  import { getReviewColumns } from './columns';

  defineOptions({
    name: 'DocumentReviewList',
  });

  // 1. 元数据与表单初始化
  const documentMeta = ref<DocumentMetaResult | null>(null);

  const fetchDocumentMeta = async () => {
    try {
      const res = await documentGetMeta();
      documentMeta.value = res;
    } catch (e) {
      console.warn('获取文档元数据字典失败:', e);
    }
  };

  onMounted(() => {
    fetchDocumentMeta();
  });

  const [DynamicTable, dynamicTableInstance] = useTable({
    formProps: {
      autoSubmitOnEnter: true,
      labelWidth: 80,
      showAdvancedButton: false,
    },
  });

  // 2. 看板统计数据
  const pendingTotal = ref(0);
  const riskAlertTotal = ref(0);
  const avgScore = ref(85);

  // 3. 走查抽屉与历史轨迹
  const reportDrawerVisible = ref(false);
  const activeReportDoc = ref<DocumentItem | null>(null);
  const approvalHistory = ref<any[]>([]);

  const handleOpenReport = async (record: DocumentItem) => {
    activeReportDoc.value = record;
    approvalHistory.value = [];
    reportDrawerVisible.value = true;

    try {
      if (record.docCode) {
        const res = await documentDetail(record.docCode);
        approvalHistory.value = res?.approvalHistory || [];
      }
    } catch (e) {
      console.warn('加载审批轨迹失败:', e);
    }
  };

  // 4. 审核通过处理
  const handleApprove = async (record: DocumentItem) => {
    try {
      if (!record.docCode) return;
      await documentAudit(record.docCode, {
        action: 'APPROVE',
        comment: '合规走查通过，准予发布入库',
      });
      message.success(`《${record.title}》已审核通过并成功发布！`);
      dynamicTableInstance?.reload();
    } catch (err: any) {
      message.error(`审核失败: ${err?.message || '未知错误'}`);
    }
  };

  const handleDrawerApprove = async () => {
    if (!activeReportDoc.value) return;
    await handleApprove(activeReportDoc.value);
    reportDrawerVisible.value = false;
  };

  // 5. 驳回修改处理
  const rejectModalVisible = ref(false);
  const rejectComment = ref('');
  const targetRejectDoc = ref<DocumentItem | null>(null);

  const openRejectModal = (record: DocumentItem) => {
    targetRejectDoc.value = record;
    rejectComment.value = '';
    rejectModalVisible.value = true;
  };

  const handleConfirmReject = async () => {
    if (!targetRejectDoc.value?.docCode) return;
    if (!rejectComment.value.trim()) {
      message.warning('请填写驳回原因说明');
      return;
    }

    try {
      await documentAudit(targetRejectDoc.value.docCode, {
        action: 'REJECT',
        comment: rejectComment.value.trim(),
      });
      message.success(`《${targetRejectDoc.value.title}》已被驳回，退回至提交人草稿箱`);
      rejectModalVisible.value = false;
      reportDrawerVisible.value = false;
      dynamicTableInstance?.reload();
    } catch (err: any) {
      message.error(`驳回失败: ${err?.message || '未知错误'}`);
    }
  };

  // 6. 列配置
  const columns = computed(() =>
    getReviewColumns({
      onOpenReport: handleOpenReport,
      onApprove: handleApprove,
      onReject: openRejectModal,
      meta: documentMeta.value,
    }),
  );

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // 7. 加载待审核数据 (status 强制锁定为 UNDER_REVIEW)
  const loadTableData = async (params: LoadDataParams & Record<string, any>) => {
    const { keyword, category, page = 1, pageSize = 10 } = params;

    try {
      const res = await documentList({
        page,
        pageSize,
        keyword,
        category,
        status: 'UNDER_REVIEW',
      });

      const rawItems = res?.items || [];
      const total = res?.total || 0;

      const items: DocumentItem[] = rawItems.map((doc: any) => ({
        id: doc.id,
        docCode: doc.docCode,
        title: doc.title,
        fileName: doc.fileName,
        extension: doc.fileType || 'pdf',
        category: doc.category || '通用',
        deptName: doc.visibleDeptNames?.[0] || '技术中心',
        scope: doc.scope,
        visibleDeptIds: doc.visibleDeptIds,
        visibleDeptNames: doc.visibleDeptNames,
        status: doc.status || 'UNDER_REVIEW',
        sizeStr: formatFileSize(doc.fileSize),
        chunkCount: Math.ceil(doc.fileSize / (100 * 1024)) || 1,
        vectorStatus: doc.vectorStatus || 'unprocessed',
        reviewStatus: doc.reviewStatus || 'AI_REVIEWING',
        reviewScore: Number(doc.reviewScore) || 0,
        author: doc.creator || '提交人',
        updatedAt: doc.updatedAt ? doc.updatedAt.replace('T', ' ').substring(0, 16) : '刚刚',
        storageKey: doc.storageKey,
        publicUrl: doc.publicUrl,
        issues: [],
      }));

      pendingTotal.value = total;
      riskAlertTotal.value = items.filter(
        (d) => d.reviewStatus === 'MANUAL_REVIEWING' || (d.reviewScore > 0 && d.reviewScore < 80),
      ).length;
      if (items.length > 0) {
        const scores = items.map((i) => i.reviewScore).filter(Boolean);
        avgScore.value = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 85;
      }

      return {
        items,
        total,
        page,
        pageSize,
      };
    } catch (err: any) {
      console.error('加载待审核文档列表异常:', err);
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

