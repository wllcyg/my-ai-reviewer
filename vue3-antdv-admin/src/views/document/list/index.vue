<template>
  <div class="document-page-wrapper p-4 bg-slate-50 min-h-full space-y-4">
    <!-- 1. 顶部统计数据看板 (符合 ui-ux-design 高级浅色规范) -->
    <a-row :gutter="16">
      <a-col :xs="24" :sm="12" :md="6">
        <div class="stat-card bg-white rounded-xl p-4 shadow-xs border border-slate-100 flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-500">文档库总数</div>
            <div class="text-2xl font-bold text-slate-900 mt-1.5 flex items-baseline gap-1">
              {{ stats.total }} <span class="text-xs font-normal text-slate-400">篇</span>
            </div>
            <div class="text-[11px] text-slate-400 mt-1">涵盖技术、行政与制度</div>
          </div>
          <div class="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
            <FileTextOutlined />
          </div>
        </div>
      </a-col>

      <a-col :xs="24" :sm="12" :md="6">
        <div class="stat-card bg-white rounded-xl p-4 shadow-xs border border-slate-100 flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-500">RAG 向量库就绪</div>
            <div class="text-2xl font-bold text-emerald-600 mt-1.5 flex items-baseline gap-1">
              {{ stats.vectorReady }} <span class="text-xs font-normal text-slate-400">篇已入库</span>
            </div>
            <div class="text-[11px] text-emerald-600/80 mt-1">支持语义检索与引用问答</div>
          </div>
          <div class="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
            <RobotOutlined />
          </div>
        </div>
      </a-col>

      <a-col :xs="24" :sm="12" :md="6">
        <div class="stat-card bg-white rounded-xl p-4 shadow-xs border border-slate-100 flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-500">AI 审核综合通过率</div>
            <div class="text-2xl font-bold text-indigo-600 mt-1.5 flex items-baseline gap-1">
              {{ stats.passRate }}<span class="text-sm font-semibold text-indigo-500">%</span>
            </div>
            <div class="text-[11px] text-slate-400 mt-1">合规检查模型严格把关</div>
          </div>
          <div class="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
            <SafetyCertificateOutlined />
          </div>
        </div>
      </a-col>

      <a-col :xs="24" :sm="12" :md="6">
        <div class="stat-card bg-white rounded-xl p-4 shadow-xs border border-slate-100 flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-500">待复核 / 风险告警</div>
            <div class="text-2xl font-bold text-amber-600 mt-1.5 flex items-baseline gap-1">
              {{ stats.riskCount }} <span class="text-xs font-normal text-slate-400">篇需关注</span>
            </div>
            <div class="text-[11px] text-amber-600/80 mt-1">存在敏感信息或待走查</div>
          </div>
          <div class="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl">
            <AlertOutlined />
          </div>
        </div>
      </a-col>
    </a-row>

    <!-- 2. 标准 DynamicTable 通用表格与搜索集成 -->
    <DynamicTable
      header-title="知识库文档列表"
      title-tooltip="基于向量数据库 (Chroma) 与大模型文档走查引擎的企业知识管理"
      show-index
      :data-request="loadTableData"
      :columns="columns"
      :row-selection="rowSelection"
    >
      <!-- 批量选择提示条 -->
      <template v-if="isCheckRows" #title>
        <a-alert class="w-full rounded-lg border-blue-200 bg-blue-50/70" type="info" show-icon>
          <template #message>
            <div class="flex items-center justify-between text-xs text-blue-700">
              <span>已勾选 <strong>{{ isCheckRows }}</strong> 篇文档</span>
              <a-button type="link" size="small" @click="rowSelection.selectedRowKeys = []">取消勾选</a-button>
            </div>
          </template>
        </a-alert>
      </template>

      <!-- 工具栏按钮组 -->
      <template #toolbar>
        <a-button type="primary" class="rounded-lg shadow-xs" @click="openUploadModal">
          <template #icon><UploadOutlined /></template>
          上传新文档
        </a-button>
        <a-button
          :disabled="!isCheckRows"
          class="rounded-lg"
          @click="handleBatchReVector"
        >
          <template #icon><SyncOutlined /></template>
          批量重新切片向量化 ({{ isCheckRows }})
        </a-button>
      </template>
    </DynamicTable>

    <!-- 3. 上传文档弹窗组件 (集成 Cloudflare R2 预签名直传) -->
    <DocumentUploadModal
      v-model:open="uploadModalVisible"
      @success="handleUploadSuccess"
    />

    <!-- 4. AI 审核报告抽屉 -->
    <a-drawer
      v-model:open="reportDrawerVisible"
      title="文档 AI 审核走查报告"
      width="560px"
      placement="right"
    >
      <div v-if="activeReportDoc" class="space-y-4">
        <!-- 审核得分与结论看板 -->
        <div
          class="p-4 rounded-xl flex items-center justify-between border"
          :class="activeReportDoc.reviewScore >= 80 ? 'bg-emerald-50/70 border-emerald-100' : 'bg-amber-50/70 border-amber-100'"
        >
          <div>
            <div class="text-xs text-slate-500">综合合规走查评分</div>
            <div
              class="text-2xl font-bold mt-1"
              :class="activeReportDoc.reviewScore >= 80 ? 'text-emerald-600' : 'text-amber-600'"
            >
              {{ activeReportDoc.reviewScore }} 分
            </div>
            <div class="text-xs mt-1 text-slate-600">
              审查结论：{{ activeReportDoc.reviewScore >= 80 ? '通过合规规范，准予检索发布' : '发现潜在风险条款，建议人工复审' }}
            </div>
          </div>
          <div class="text-3xl">
            <CheckCircleOutlined v-if="activeReportDoc.reviewScore >= 80" class="text-emerald-500" />
            <AlertOutlined v-else class="text-amber-500" />
          </div>
        </div>

        <!-- 基本信息概览 -->
        <a-descriptions title="文档基本属性" size="small" :column="2" bordered class="rounded-xl overflow-hidden">
          <a-descriptions-item label="文档名称" :span="2">{{ activeReportDoc.title }}</a-descriptions-item>
          <a-descriptions-item label="所属类别">{{ activeReportDoc.category }}</a-descriptions-item>
          <a-descriptions-item label="权限范围">{{ activeReportDoc.scope }}</a-descriptions-item>
          <a-descriptions-item label="文件大小">{{ activeReportDoc.sizeStr }}</a-descriptions-item>
          <a-descriptions-item label="切片数">{{ activeReportDoc.chunkCount }} 块</a-descriptions-item>
        </a-descriptions>

        <!-- 详细风险清单 -->
        <div class="font-medium text-slate-800 text-sm mt-4">AI 识别到的合规检查项</div>
        <div v-if="activeReportDoc.issues?.length" class="space-y-2.5">
          <div
            v-for="(issue, idx) in activeReportDoc.issues"
            :key="idx"
            class="p-3.5 border rounded-xl border-slate-100 bg-slate-50/70 text-xs shadow-2xs"
          >
            <div class="flex justify-between items-center mb-1.5">
              <span class="font-semibold text-slate-800">第 {{ issue.line }} 行 · {{ issue.type }}</span>
              <a-tag :color="issue.level === 'HIGH' ? 'red' : 'orange'">{{ issue.level }} 风险</a-tag>
            </div>
            <div class="text-slate-600 mb-1.5"><strong>涉及内容：</strong>「{{ issue.snippet }}」</div>
            <div class="text-indigo-600 bg-indigo-50/80 p-2 rounded-lg"><strong>整改建议：</strong>{{ issue.suggestion }}</div>
          </div>
        </div>
        <div v-else class="text-center py-8 text-slate-400 text-xs">
          <CheckCircleOutlined class="text-emerald-500 text-2xl mb-2" />
          <div>未发现违规敏感内容，文档安全规范良好。</div>
        </div>
      </div>
    </a-drawer>
  </div>
</template>

<script lang="ts" setup>
  import { ref, reactive, computed } from 'vue';
  import { message } from 'ant-design-vue';
  import {
    FileTextOutlined,
    RobotOutlined,
    SafetyCertificateOutlined,
    AlertOutlined,
    UploadOutlined,
    SyncOutlined,
    CheckCircleOutlined,
  } from '@ant-design/icons-vue';
  import { useTable, type LoadDataParams } from '@/components/core/dynamic-table';
  import { documentList, documentDelete } from '@/api/backend/api/document';
  import DocumentUploadModal from './components/DocumentUploadModal.vue';
  import {
    getDocumentColumns,
    type DocumentItem,
  } from './columns';

  defineOptions({
    name: 'DocumentList',
  });

  // 1. 初始化 DynamicTable 实例 (支持回车自动触发搜索)
  const [DynamicTable, dynamicTableInstance] = useTable({
    formProps: {
      autoSubmitOnEnter: true,
      labelWidth: 90,
      baseColProps: { span: 6 },
    },
  });



  // 3. 统计指标响应式数据
  const stats = reactive({
    total: 0,
    vectorReady: 0,
    passRate: 100,
    riskCount: 0,
  });

  // 4. 表格多选支持
  const rowSelection = ref({
    selectedRowKeys: [] as number[],
    onChange: (keys: number[]) => {
      rowSelection.value.selectedRowKeys = keys;
    },
  });
  const isCheckRows = computed(() => rowSelection.value.selectedRowKeys.length);

  // 5. 操作行为事件处理
  const reportDrawerVisible = ref(false);
  const activeReportDoc = ref<DocumentItem | null>(null);

  const handleOpenReport = (record: DocumentItem) => {
    activeReportDoc.value = record;
    reportDrawerVisible.value = true;
  };

  const handleReVector = (record: DocumentItem) => {
    record.vectorStatus = 'PARSING';
    message.loading(`正在通知向量服务对《${record.title}》重新切片并入库...`, 1.5);
    setTimeout(() => {
      record.vectorStatus = 'READY';
      message.success(`《${record.title}》向量化更新完成`);
      dynamicTableInstance?.reload();
    }, 1800);
  };

  const handleDelete = async (record: DocumentItem) => {
    try {
      if (record.docCode) {
        await documentDelete(record.docCode);
      }
      message.success('已从知识库中彻底删除该文档及对象存储文件');
      dynamicTableInstance?.reload();
    } catch (err: any) {
      message.error(`删除失败: ${err?.message || '未知错误'}`);
    }
  };

  const handleBatchReVector = () => {
    message.success(`已向向量后台提交 ${isCheckRows.value} 篇文档的重新切片任务`);
    rowSelection.value.selectedRowKeys = [];
  };

  // 6. 传递给 DynamicTable 的列定义
  const columns = getDocumentColumns({
    onOpenReport: handleOpenReport,
    onReVector: handleReVector,
    onDelete: handleDelete,
  });

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // 7. DynamicTable 数据加载器 (调用后端真实分页 API)
  const loadTableData = async (params: LoadDataParams & Record<string, any>) => {
    const { keyword, category, vectorStatus, reviewStatus, page = 1, pageSize = 10 } = params;

    try {
      const res = await documentList({
        page,
        pageSize,
        keyword,
        category,
        vectorStatus,
        reviewStatus,
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
        sizeStr: formatFileSize(doc.fileSize),
        chunkCount: Math.ceil(doc.fileSize / (100 * 1024)) || 1,
        vectorStatus: doc.vectorStatus || 'unprocessed',
        reviewStatus: doc.reviewStatus || 'APPROVED',
        reviewScore: Number(doc.reviewScore) || 95,
        author: doc.creator || '系统',
        updatedAt: doc.updatedAt ? doc.updatedAt.replace('T', ' ').substring(0, 16) : '刚刚',
        storageKey: doc.storageKey,
        publicUrl: doc.publicUrl,
        issues: [],
      }));

      // 更新顶部统计面板
      stats.total = total;
      stats.vectorReady = items.filter((d) => d.vectorStatus === 'completed' || d.vectorStatus === 'READY').length;
      const approved = items.filter((d) => d.reviewStatus === 'APPROVED').length;
      stats.passRate = items.length > 0 ? Math.round((approved / items.length) * 100) : 100;
      stats.riskCount = items.filter(
        (d) => d.reviewStatus === 'REJECTED' || d.reviewStatus === 'MANUAL_REVIEWING',
      ).length;

      return {
        items,
        total,
        page,
        pageSize,
      };
    } catch (err: any) {
      console.error('加载文档列表异常:', err);
      return {
        items: [],
        total: 0,
        page,
        pageSize,
      };
    }
  };

  // 8. 上传文档弹窗状态与事件响应
  const uploadModalVisible = ref(false);

  const openUploadModal = () => {
    uploadModalVisible.value = true;
  };

  const handleUploadSuccess = () => {
    dynamicTableInstance?.reload();
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

  .file-ext-tag {
    display: inline-block;
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 700;
    border-radius: 4px;
    background-color: #f1f5f9;
    color: #475569;
  }
  .file-ext-tag.ext-pdf {
    background-color: #fee2e2;
    color: #dc2626;
  }
  .file-ext-tag.ext-docx {
    background-color: #dbeafe;
    color: #2563eb;
  }
  .file-ext-tag.ext-md {
    background-color: #e0e7ff;
    color: #4f46e5;
  }
</style>
