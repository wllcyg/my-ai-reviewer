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
  import { ref, computed } from 'vue';
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

  // 2. 模拟本地持久数据源 (对接后端 API 后直接替换为 Api.document.list)
  const rawDocumentList = ref<DocumentItem[]>([
    {
      id: 1,
      title: '公司打卡与弹性工作制规范.docx',
      extension: 'docx',
      category: '人事行政',
      deptName: 'HR部',
      scope: 'PUBLIC',
      sizeStr: '128 KB',
      chunkCount: 6,
      vectorStatus: 'READY',
      reviewStatus: 'APPROVED',
      reviewScore: 96,
      author: 'HR管理员',
      updatedAt: '2026-10-28 10:20',
      issues: [],
    },
    {
      id: 2,
      title: '差旅报销与住宿补贴标准.pdf',
      extension: 'pdf',
      category: '财务制度',
      deptName: '财务部',
      scope: 'DEPT',
      visibleDeptIds: [301, 302],
      visibleDeptNames: ['财务部', 'HR 人力资源部'],
      sizeStr: '2.4 MB',
      chunkCount: 18,
      vectorStatus: 'READY',
      reviewStatus: 'APPROVED',
      reviewScore: 92,
      author: '财务部出纳',
      updatedAt: '2026-10-27 15:45',
      issues: [],
    },
    {
      id: 3,
      title: '前端代码规范与发版门禁流程.md',
      extension: 'md',
      category: '技术规范',
      deptName: '技术中心',
      scope: 'PUBLIC',
      sizeStr: '45 KB',
      chunkCount: 8,
      vectorStatus: 'READY',
      reviewStatus: 'APPROVED',
      reviewScore: 98,
      author: '前端架构组',
      updatedAt: '2026-10-28 09:12',
      issues: [],
    },
    {
      id: 4,
      title: '生产环境数据库跳板机访问与密码轮换细则.pdf',
      extension: 'pdf',
      category: '安全合规',
      deptName: '运维与基础设施组',
      scope: 'DEPT',
      visibleDeptIds: [103, 201],
      visibleDeptNames: ['运维与基础设施组', '数据安全组'],
      sizeStr: '1.2 MB',
      chunkCount: 14,
      vectorStatus: 'READY',
      reviewStatus: 'REJECTED',
      reviewScore: 68,
      author: '运维负责人',
      updatedAt: '2026-10-28 14:05',
      issues: [
        {
          line: 35,
          type: '敏感凭证泄露风险',
          level: 'HIGH',
          snippet: '临时测试跳板机 root 默认弱口令为 123456',
          suggestion: '请彻底移除明文密码，改为引用统一密码管理器或 MFA 指引。',
        },
      ],
    },
    {
      id: 5,
      title: 'My AI Reviewer 智能代码走查助手接口说明.md',
      extension: 'md',
      category: '产品说明',
      deptName: 'AI研发组',
      scope: 'PUBLIC',
      sizeStr: '88 KB',
      chunkCount: 9,
      vectorStatus: 'PARSING',
      reviewStatus: 'REVIEWING',
      reviewScore: 0,
      author: 'AI研发员',
      updatedAt: '2026-10-28 15:10',
      issues: [],
    },
  ]);

  // 3. 统计指标计算
  const stats = computed(() => {
    const total = rawDocumentList.value.length;
    const vectorReady = rawDocumentList.value.filter((d) => d.vectorStatus === 'READY').length;
    const approved = rawDocumentList.value.filter((d) => d.reviewStatus === 'APPROVED').length;
    const passRate = total > 0 ? Math.round((approved / total) * 100) : 0;
    const riskCount = rawDocumentList.value.filter(
      (d) => d.reviewStatus === 'REJECTED' || d.reviewStatus === 'REVIEWING',
    ).length;
    return { total, vectorReady, passRate, riskCount };
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

  const handleDelete = (record: DocumentItem) => {
    rawDocumentList.value = rawDocumentList.value.filter((item) => item.id !== record.id);
    message.success('已删除文档及其向量索引');
    dynamicTableInstance?.reload();
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

  // 7. DynamicTable 数据加载器 (自动接收搜索表单参数 params 进行分页过滤)
  const loadTableData = async (params: LoadDataParams & Record<string, any>) => {
    const { keyword, category, vectorStatus, reviewStatus, page = 1, pageSize = 10 } = params;

    let filtered = rawDocumentList.value;
    if (keyword) {
      filtered = filtered.filter((item) =>
        item.title.toLowerCase().includes(keyword.trim().toLowerCase()),
      );
    }
    if (category) {
      filtered = filtered.filter((item) => item.category === category);
    }
    if (vectorStatus) {
      filtered = filtered.filter((item) => item.vectorStatus === vectorStatus);
    }
    if (reviewStatus) {
      filtered = filtered.filter((item) => item.reviewStatus === reviewStatus);
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = filtered.slice(start, end);

    return {
      items,
      total: filtered.length,
      page,
      pageSize,
    };
  };

  // 8. 上传文档弹窗状态与事件响应
  const uploadModalVisible = ref(false);

  const openUploadModal = () => {
    uploadModalVisible.value = true;
  };

  const handleUploadSuccess = (newDoc: DocumentItem) => {
    rawDocumentList.value.unshift(newDoc);
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
