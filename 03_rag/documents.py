"""
03_rag 测试用的源数据文档集
模拟一家科技公司内部的【业务规范、系统架构、员工手册】等私有知识。
大模型预训练中不可能学过这些具体细则，非常适合用来测试验证 RAG 的检索增强效果。
"""

from langchain_core.documents import Document

# 1. 纯文本格式列表（适合直接用于底层/原生 Chroma 测试）
RAW_DOCUMENTS = [
    {
        "id": "doc_001",
        "title": "公司打卡与弹性工作制规范",
        "content": "公司实行弹性工时制，标准工作时长为每天 8 小时。员工可在早上 9:00 至 10:00 之间弹性打卡上班，下班时间相应顺延（如 9:30 上班，则 18:30 下班）。核心工作时间为 10:00-17:00，此期间全员需保持飞书在线响应。每月有 3 次 30 分钟以内的免扣款忘打卡补卡机会。",
        "category": "人事行政",
        "author": "HR部门",
    },
    {
        "id": "doc_002",
        "title": "差旅报销与住宿标准",
        "content": "一线城市（北上广深）住宿补贴标准为每晚不超过 500 元，新一线及二线城市每晚不超过 350 元。出差期间餐补为每天 100 元，按自然日天数实发，无需发票。所有报销单据必须在出差行程结束后 7 个工作日内通过 OA 提交，逾期将自动冻结当期报销通道。",
        "category": "财务制度",
        "author": "财务部",
    },
    {
        "id": "doc_003",
        "title": "前端代码规范与发版流程",
        "content": "前端代码统一采用 Vue3 + TypeScript 技术栈。分支管理采用 Git Flow：功能分支命名为 feature/xxx，修复分支为 hotfix/xxx。每周四下午 16:00 为常规发版窗口期，周五及节假日前一天严禁进行任何生产环境发版。发版前必须通过 ESLint 静态代码检查和单元测试覆盖率（门禁为 80%）。",
        "category": "技术规范",
        "author": "架构组",
    },
    {
        "id": "doc_004",
        "title": "生产环境数据库访问权限与密码轮换",
        "content": "生产数据库禁止直连，必须通过 JumpServer 跳板机进行审计访问。跳板机登录启用 MFA 双因子认证。生产数据库账号密码每 90 天自动轮换一次，新密码由密码管理器随机生成，长度不低于 16 位，包含大小写字母、数字及特殊字符。严禁在 Git 仓库或配置文件中硬编码明文密码。",
        "category": "安全合规",
        "author": "运维安全组",
    },
    {
        "id": "doc_005",
        "title": "内部 AI 审核助手（My AI Reviewer）接口说明",
        "content": "My AI Reviewer 是内部基于大模型研发的代码走查工具。核心服务监听在 8000 端口，对外提供 /api/v1/review 审查接口。调用时请求头需携带 X-Project-Token。单次提交审查的 Pull Request 代码变更最大限制为 2000 行，超过将自动触发分批异步走查机制，走查报告异步推送到企业微信机器人。",
        "category": "产品说明",
        "author": "AI研发组",
    },
    {
        "id": "doc_006",
        "title": "年假计算规则与带薪病假",
        "content": "入职满 1 年的员工享有法定年假 5 天，司龄每增加 1 年增加 1 天福利年假，每年上限共 15 天。未休年假可在次年 3 月 31 日前完成顺延，逾期自动作废。每自然年每位员工享有 5 天全薪病假，请假超过 2 天需在 OA 补交二级甲等以上医院开具的就诊凭证与假条。",
        "category": "人事行政",
        "author": "HR部门",
    },
]

# 2. 转换为标准 LangChain Document 对象的列表（适合直接用于 LangChain 向量库检索与链式调用）
SAMPLE_DOCUMENTS = [
    Document(
        page_content=f"【{item['title']}】\n{item['content']}",
        metadata={
            "doc_id": item["id"],
            "title": item["title"],
            "category": item["category"],
            "author": item["author"],
        },
    )
    for item in RAW_DOCUMENTS
]


def get_sample_documents() -> list[Document]:
    """获取 LangChain 格式的测试文档列表"""
    return SAMPLE_DOCUMENTS


def get_raw_documents() -> list[dict]:
    """获取字典格式的原始测试文档列表"""
    return RAW_DOCUMENTS


if __name__ == "__main__":
    print(f"成功加载测试数据，共计 {len(SAMPLE_DOCUMENTS)} 篇文档：")
    for doc in SAMPLE_DOCUMENTS:
        print(f"- [{doc.metadata['category']}] {doc.metadata['title']}")
