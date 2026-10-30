<template>
  <a-modal
    :open="open"
    title="上传新文档到知识库"
    :confirm-loading="uploadSubmitting"
    class="rounded-2xl"
    :mask-closable="!uploadSubmitting"
    @ok="handleConfirmUpload"
    @cancel="handleCancel"
  >
    <a-form layout="vertical" :model="uploadForm" class="pt-2">
      <a-form-item label="文档标题" required>
        <a-input
          v-model:value="uploadForm.title"
          placeholder="如：2026年度财务报销与出差规范"
          class="rounded-lg"
          :disabled="uploadSubmitting"
        />
      </a-form-item>

      <a-form-item label="文档分类" required>
        <a-select
          v-model:value="uploadForm.category"
          placeholder="请选择分类"
          :options="categoryOptions"
          class="rounded-lg"
          :disabled="uploadSubmitting"
        />
      </a-form-item>

      <a-form-item label="访问权限范围" required>
        <a-radio-group v-model:value="uploadForm.scope" :disabled="uploadSubmitting">
          <a-radio value="PUBLIC">全员公开 (公共知识库)</a-radio>
          <a-radio value="DEPT">指定部门可见 (多选授权)</a-radio>
          <a-radio value="PRIVATE">私密文档 (仅授权人)</a-radio>
        </a-radio-group>
      </a-form-item>

      <!-- 当选择 DEPT 时，条件联动展示部门多选树 -->
      <a-form-item
        v-if="uploadForm.scope === 'DEPT'"
        label="指定允许查阅的部门 (支持跨部门勾选)"
        required
      >
        <a-tree-select
          v-model:value="uploadForm.visibleDeptIds"
          :tree-data="authorizedDeptTree"
          tree-checkable
          allow-clear
          :show-checked-strategy="TreeSelect.SHOW_ALL"
          placeholder="请勾选允许查阅该文档的部门 (可多选)"
          class="rounded-lg w-full"
          :disabled="uploadSubmitting"
        />
        <div class="text-[11px] text-slate-400 mt-1">
          💡 仅被勾选部门的员工拥有该文档的查阅权限及 RAG 语义检索能力。
        </div>
      </a-form-item>

      <a-form-item label="上传文件 (支持 PDF, Word, Markdown, TXT)" required>
        <a-upload-dragger
          v-model:fileList="fileList"
          :max-count="1"
          :before-upload="beforeUpload"
          :disabled="uploadSubmitting"
          class="rounded-xl"
        >
          <p class="ant-upload-drag-icon text-indigo-500">
            <InboxOutlined />
          </p>
          <p class="ant-upload-text font-medium text-slate-700">点击或将文件拖拽到此区域上传</p>
          <p class="ant-upload-hint text-xs text-slate-400">
            单文件大小不超过 50MB。采用 Cloudflare R2 客户端极速直传。
          </p>
        </a-upload-dragger>
      </a-form-item>

      <!-- 上传进度条展示 -->
      <div v-if="uploadSubmitting" class="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
        <div class="flex justify-between items-center text-xs">
          <span class="text-indigo-600 font-medium flex items-center gap-1.5">
            <LoadingOutlined spin />
            正在直传至 Cloudflare R2 存储桶...
          </span>
          <span class="text-slate-500 font-semibold">{{ uploadPercent }}%</span>
        </div>
        <a-progress :percent="uploadPercent" :show-info="false" stroke-color="#4f46e5" size="small" />
      </div>

      <div class="bg-indigo-50/60 border border-indigo-100 p-3 rounded-xl text-xs text-indigo-700 flex items-center gap-2 mt-2">
        <RobotOutlined class="text-base text-indigo-600 shrink-0" />
        <span>直传完成后，系统将自动触发语义切片向量化与 AI 智能合规风险审查。</span>
      </div>
    </a-form>
  </a-modal>
</template>

<script lang="ts" setup>
  import { ref, reactive, watch } from 'vue';
  import { message, TreeSelect, type UploadProps } from 'ant-design-vue';
  import { InboxOutlined, RobotOutlined, LoadingOutlined } from '@ant-design/icons-vue';
  import axios from 'axios';
  import { documentGetUploadSign, documentCreate } from '@/api/backend/api/document';
  import { categoryOptions, authorizedDeptTree, type DocumentItem } from '../columns';

  defineOptions({
    name: 'DocumentUploadModal',
  });

  const props = withDefaults(
    defineProps<{
      open: boolean;
    }>(),
    {
      open: false,
    },
  );

  const emit = defineEmits<{
    (e: 'update:open', val: boolean): void;
    (e: 'success', doc: DocumentItem): void;
  }>();

  const uploadSubmitting = ref(false);
  const uploadPercent = ref(0);
  const fileList = ref<any[]>([]);

  const uploadForm = reactive({
    title: '',
    category: undefined as string | undefined,
    scope: 'PUBLIC' as 'PUBLIC' | 'DEPT' | 'PRIVATE',
    visibleDeptIds: [101, 102] as number[], // 默认勾选当前用户的管辖部门
  });

  // 监听打开状态，重置表单
  watch(
    () => props.open,
    (val) => {
      if (val) {
        uploadForm.title = '';
        uploadForm.category = undefined;
        uploadForm.scope = 'PUBLIC';
        uploadForm.visibleDeptIds = [101, 102];
        fileList.value = [];
        uploadPercent.value = 0;
        uploadSubmitting.value = false;
      }
    },
  );

  // 文件选取前拦截，提取元数据
  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    // 自动用文件名（去后缀）作为默认标题
    if (!uploadForm.title) {
      uploadForm.title = file.name.replace(/\.[^/.]+$/, '');
    }
    return false; // 阻止 Antd 默认的立即上传行为，交由我们直传
  };

  const handleCancel = () => {
    if (uploadSubmitting.value) {
      message.warning('文件正在直传中，请稍候...');
      return;
    }
    emit('update:open', false);
  };

  // 格式化文件体积大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // 执行获取预签名并直传
  const handleConfirmUpload = async () => {
    if (!uploadForm.title.trim()) {
      message.warning('请输入文档标题');
      return;
    }
    if (!uploadForm.category) {
      message.warning('请选择文档分类');
      return;
    }
    if (!fileList.value.length) {
      message.warning('请选择或拖拽需要上传的文档');
      return;
    }

    if (uploadForm.scope === 'DEPT' && (!uploadForm.visibleDeptIds || !uploadForm.visibleDeptIds.length)) {
      message.warning('请至少勾选一个允许查阅的部门');
      return;
    }

    const rawFile = fileList.value[0]?.originFileObj as File;
    if (!rawFile) {
      message.warning('获取文件失败，请重新选择');
      return;
    }

    if (rawFile.size > 50 * 1024 * 1024) {
      message.error('文件大小超出限制，最大允许 50MB');
      return;
    }

    uploadSubmitting.value = true;
    uploadPercent.value = 0;

    // 递归解析选中的部门中文名列表
    const resolveDeptNames = (selectedIds: number[]): string[] => {
      const names: string[] = [];
      const traverse = (nodes: any[]) => {
        for (const node of nodes) {
          if (selectedIds.includes(node.value)) {
            names.push(node.title);
          }
          if (node.children?.length) {
            traverse(node.children);
          }
        }
      };
      traverse(authorizedDeptTree);
      return names;
    };

    const selectedDeptNames = uploadForm.scope === 'DEPT' ? resolveDeptNames(uploadForm.visibleDeptIds) : [];

    try {
      // 1. 请求后端获取 Cloudflare R2 预签名直传凭据
      const signRes = await documentGetUploadSign({
        fileName: rawFile.name,
        fileSize: rawFile.size,
        contentType: rawFile.type || 'application/octet-stream',
        category: uploadForm.category,
        scope: uploadForm.scope,
      });

      const { uploadUrl, storageKey, publicUrl } = signRes;

      // 2. 客户端直接发起 HTTP PUT 直传到 Cloudflare R2 (不占后端服务器带宽)
      await axios.put(uploadUrl, rawFile, {
        headers: {
          'Content-Type': rawFile.type || 'application/octet-stream',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            uploadPercent.value = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          }
        },
      });

      // 3. 调用后端落库接口持久化到 MySQL
      const ext = rawFile.name.split('.').pop()?.toLowerCase() || 'pdf';
      const savedDoc = await documentCreate({
        title: uploadForm.title.trim(),
        category: uploadForm.category,
        fileName: rawFile.name,
        fileSize: rawFile.size,
        fileType: ext,
        storageKey,
        publicUrl,
        scope: uploadForm.scope as any,
        visibleDeptIds: uploadForm.scope === 'DEPT' ? uploadForm.visibleDeptIds : [],
        visibleDeptNames: uploadForm.scope === 'DEPT' ? selectedDeptNames : [],
      });

      message.success('文档已成功直传并入库，后台正在流转审批与向量化！');

      const newDoc: DocumentItem = {
        id: savedDoc.id,
        docCode: savedDoc.docCode,
        title: savedDoc.title,
        fileName: savedDoc.fileName,
        extension: ext,
        category: savedDoc.category || uploadForm.category || '通用',
        deptName: selectedDeptNames[0] || '技术中心',
        scope: savedDoc.scope,
        visibleDeptIds: savedDoc.visibleDeptIds,
        visibleDeptNames: savedDoc.visibleDeptNames,
        sizeStr: formatFileSize(savedDoc.fileSize),
        chunkCount: Math.ceil(savedDoc.fileSize / (100 * 1024)) || 1,
        vectorStatus: savedDoc.vectorStatus,
        reviewStatus: savedDoc.reviewStatus,
        reviewScore: savedDoc.reviewScore || 0,
        author: savedDoc.creator || '当前用户',
        updatedAt: '刚刚',
        storageKey: savedDoc.storageKey,
        publicUrl: savedDoc.publicUrl,
        issues: [],
      };

      emit('success', newDoc);
      emit('update:open', false);
    } catch (error: any) {
      console.error('上传失败:', error);
      const errorMsg = error?.response?.data?.message || error?.message || '直传失败，请检查网络或 CORS 配置';
      message.error(`上传失败: ${errorMsg}`);
    } finally {
      uploadSubmitting.value = false;
    }
  };
</script>
