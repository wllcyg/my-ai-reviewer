# 关于 RAG 向量化与存储的实操学习
import math
import re
import sys
from collections import Counter
from pathlib import Path

# 确保能正确引入根目录的 core 和 config 模块
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

# 修复 Windows 控制台中文和字符编码问题
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

import chromadb
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings
from config import get_settings
from core.client import get_llm
from documents import get_raw_documents

# 1. 初始化配置与 LLM
settings = get_settings()
llm = get_llm(temperature=0.7)


class SimpleLocalEmbedding(EmbeddingFunction):
    """
    轻量且完全无需外部网络/下载的本地语义向量化实现（基于语义词频与固定维度哈希映射）。
    原理：
    1. 分词与词频统计
    2. 映射到一个固定的 128 维空间
    3. 进行 L2 归一化（使向量模长为 1，满足余弦相似度计算标准）
    """

    def __init__(self, dim: int = 128):
        self.dim = dim

    def _tokenize(self, text: str) -> list[str]:
        # 提取中文词元与英文字符（2字以上组合与单字）
        text = text.lower()
        chars = [c for c in text if "\u4e00" <= c <= "\u9fa5" or c.isalnum()]
        bigrams = [text[i : i + 2] for i in range(len(text) - 1)]
        return chars + bigrams

    def _embed_single(self, text: str) -> list[float]:
        tokens = self._tokenize(text)
        counts = Counter(tokens)
        vector = [0.0] * self.dim

        for token, count in counts.items():
            # 使用固定 hash 将词映射到对应维度槽位
            slot = abs(hash(token)) % self.dim
            vector[slot] += float(count)

        # 向量归一化 (L2 Normalize)，方便做余弦相似度计算
        norm = math.sqrt(sum(v * v for v in vector))
        if norm > 0:
            vector = [round(v / norm, 6) for v in vector]
        return vector

    def __call__(self, input: Documents) -> Embeddings:
        return [self._embed_single(doc) for doc in input]


# 2. 初始化本地持久化 Chroma 客户端（数据将保存在 03_rag/chroma_db 文件夹中）
CHROMA_DATA_PATH = str(Path(__file__).resolve().parent / "chroma_db")
chroma_client = chromadb.PersistentClient(path=CHROMA_DATA_PATH)

# 使用自定义免费本地嵌入函数
embed_fn = SimpleLocalEmbedding(dim=128)

# 3. 创建或获取集合（相当于一张存放知识向量的表，指定使用余弦相似度 cosine）
COLLECTION_NAME = "company_knowledge_base"

# 如果已经存在旧集合，先清理重置，确保测试数据纯净
try:
    chroma_client.delete_collection(COLLECTION_NAME)
except Exception:
    pass

collection = chroma_client.create_collection(
    name=COLLECTION_NAME,
    embedding_function=embed_fn,
    metadata={"hnsw:space": "cosine"},  # 明确指定向量距离算法为【余弦相似度】
)


def step1_embed_and_store():
    """第一步：将 documents.py 中的源数据进行向量化并存入 Chroma 数据库"""
    raw_docs = get_raw_documents()

    print(f"📦 正在准备将 {len(raw_docs)} 篇原始文档存入 Chroma 数据库...")

    ids = []
    documents = []
    metadatas = []

    for item in raw_docs:
        ids.append(item["id"])
        # 拼接标题与正文
        documents.append(f"【{item['title']}】\n{item['content']}")
        metadatas.append(
            {
                "title": item["title"],
                "category": item["category"],
                "author": item["author"],
            }
        )

    # 打印前 1 篇文档的向量化结果预览，让向量具象化
    sample_text = documents[0]
    sample_vector = embed_fn([sample_text])[0]
    print("\n🔍 --- 向量化过程直观展示 ---")
    print(f"原始文本前 40 字: {sample_text[:40]}...")
    print(f"向量维度大小: {len(sample_vector)} 维")
    print(f"向量前 8 个数值预览: {sample_vector[:8]}")
    print("--------------------------------\n")

    # 执行存入数据库操作
    collection.add(
        ids=ids,
        documents=documents,
        metadatas=metadatas,
    )

    print(f"✅ 成功将 {collection.count()} 篇文档存储到 Chroma 数据库中！")
    print(f"📁 本地数据库文件存放路径: {CHROMA_DATA_PATH}")


if __name__ == "__main__":
    step1_embed_and_store()
