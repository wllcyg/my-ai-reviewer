from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List

router = APIRouter(prefix="/document", tags=["Document AI & Review"])


class DocumentProcessRequest(BaseModel):
    doc_code: str = Field(..., description="文档唯一业务编码，如 doc_xxx")
    title: str = Field(..., description="文档标题")
    file_type: str = Field(..., description="文件格式，如 pdf, docx, md, txt")
    storage_key: str = Field(..., description="Cloudflare R2 存储路径 Key")
    visible_range: str = Field("PUBLIC", description="权限范围: PUBLIC / DEPT / PRIVATE")
    dept_ids: Optional[List[int]] = Field(default=[], description="可见部门 ID 数组")
    creator_id: Optional[int] = Field(default=None, description="创建人 ID")


class DocumentProcessResponse(BaseModel):
    doc_code: str
    status: str
    message: str


async def async_process_document_pipeline(payload: DocumentProcessRequest):
    """
    异步处理管道：
    1. 从 Cloudflare R2 拉取原始文件
    2. 执行文本解析与清洗 (PDF/DOCX/MD)
    3. LLM 自动化合规初审走查并打分
    4. 语义切块 (Chunking) 并携带权限元数据写入向量数据库
    5. 状态回写到业务端
    """
    # 待开发具体逻辑...
    pass


@router.post("/process", response_model=DocumentProcessResponse)
async def process_document(
    payload: DocumentProcessRequest,
    background_tasks: BackgroundTasks,
):
    """接收来自 NestJS 业务后端的文档审核与切块异步任务"""
    if not payload.doc_code or not payload.storage_key:
        raise HTTPException(status_code=400, detail="缺少必要的文档编码或存储Key")

    # 投递到后台异步执行，不阻塞业务端 HTTP 响应
    background_tasks.add_task(async_process_document_pipeline, payload)

    return DocumentProcessResponse(
        doc_code=payload.doc_code,
        status="ACCEPTED",
        message="文档处理任务已接收，正在后台异步执行解析与向量化",
    )
