from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class DocProcessTaskPayload(BaseModel):
    """
    文档处理任务载荷契约
    严格对应 Nest 端 DocProcessMessage 协议 v2
    """
    model_config = ConfigDict(populate_by_name=True)

    schema_version: int = Field(1, alias="schemaVersion", description="协议架构版本号")
    task_id: str = Field(..., alias="taskId", description="任务全局唯一跟踪 ID")
    type: str = Field("doc.parse", description="任务类型")
    trace_id: str = Field(..., alias="traceId", description="全链路追踪 ID")
    attempt: int = Field(1, description="当前投递重试次数")

    doc_code: str = Field(..., alias="docCode", description="文档唯一业务编码")
    doc_id: int = Field(..., alias="docId", description="数据库自增 ID")
    file_id: str = Field(..., alias="fileId", description="文件唯一标识")
    title: str = Field(..., description="文档标题")
    file_type: str = Field(..., alias="fileType", description="文件格式后缀 (pdf/docx/md/txt)")
    storage_key: str = Field(..., alias="storageKey", description="Cloudflare R2 存储路径")

    visible_range: str = Field("PUBLIC", alias="visibleRange", description="可见权限范围")
    dept_ids: List[int] = Field(default_factory=list, alias="deptIds", description="可见部门 ID 数组")
    creator_id: Optional[int] = Field(None, alias="creatorId", description="创建者用户 ID")

    created_at: str = Field(..., alias="createdAt", description="消息创建时间 (ISO 8601)")
    timestamp: int = Field(..., description="消息时间戳")
