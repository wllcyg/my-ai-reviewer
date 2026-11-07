<template>
  <div class="welcome-container">
    <!-- 顶部 Banner -->
    <div class="welcome-banner">
      <div class="banner-content">
        <div class="banner-title">
          <RocketOutlined class="banner-icon" />
          <span>AI 知识库与智能评审系统 · 全链路云原生服务全景</span>
        </div>
        <p class="banner-subtitle">
          系统全面采用云原生 Serverless 与全托管云端基础设施，涵盖环境机密管理、AI 向量算力、向量数据库、对象存储、关系型数据、高速缓存、异步消息总线及全文大文本库，具备高可用、弹性伸缩与零运维成本特性。
        </p>
        <div class="banner-badges">
          <Tag color="cyan">8 大全托管云底座</Tag>
          <Tag color="blue">Serverless 全弹性</Tag>
          <Tag color="purple">OpenAI 兼容协议</Tag>
          <Tag color="green">端到端链路已就绪</Tag>
        </div>
      </div>
    </div>

    <!-- 链路模块速览条 -->
    <div class="pipeline-summary-row">
      <Row :gutter="[16, 16]">
        <Col :xs="24" :sm="12" :md="6">
          <div class="summary-metric-card">
            <div class="metric-icon security-icon">
              <SafetyCertificateOutlined />
            </div>
            <div class="metric-text">
              <span class="metric-label">环境与机密</span>
              <span class="metric-value">Infisical E2EE</span>
            </div>
          </div>
        </Col>
        <Col :xs="24" :sm="12" :md="6">
          <div class="summary-metric-card">
            <div class="metric-icon ai-icon">
              <ApartmentOutlined />
            </div>
            <div class="metric-text">
              <span class="metric-label">AI 向量模型</span>
              <span class="metric-value">BGE-M3 (1024维)</span>
            </div>
          </div>
        </Col>
        <Col :xs="24" :sm="12" :md="6">
          <div class="summary-metric-card">
            <div class="metric-icon storage-icon">
              <DatabaseOutlined />
            </div>
            <div class="metric-text">
              <span class="metric-label">云端向量库</span>
              <span class="metric-value">CF Vectorize</span>
            </div>
          </div>
        </Col>
        <Col :xs="24" :sm="12" :md="6">
          <div class="summary-metric-card">
            <div class="metric-icon mq-icon">
              <ApiOutlined />
            </div>
            <div class="metric-text">
              <span class="metric-label">异步流水线</span>
              <span class="metric-value">CloudAMQP (RabbitMQ)</span>
            </div>
          </div>
        </Col>
      </Row>
    </div>

    <!-- 云端服务卡片矩阵 -->
    <div class="section-title">
      <CloudServerOutlined style="color: #1890ff; margin-right: 8px" />
      <span>云基础设施底座详情清单</span>
    </div>

    <Row :gutter="[16, 16]">
      <Col v-for="item in cloudServices" :key="item.name" :xs="24" :sm="12" :lg="8" :xl="6">
        <Card hoverable class="service-card" :bordered="false">
          <template #title>
            <div class="card-header">
              <span class="service-title">{{ item.name }}</span>
              <Tag :color="item.categoryColor">{{ item.category }}</Tag>
            </div>
          </template>
          <template #extra>
            <Badge status="processing" text="已接入" />
          </template>

          <div class="service-body">
            <p class="service-desc">{{ item.description }}</p>
            <div class="service-tags">
              <Tag v-for="t in item.tags" :key="t" class="spec-tag">{{ t }}</Tag>
            </div>
          </div>

          <div class="card-footer">
            <a :href="item.website" target="_blank" rel="noopener noreferrer" class="link-btn">
              <Button type="link" size="small" style="padding: 0">
                访问官网 / 控制台
                <LinkOutlined style="margin-left: 4px" />
              </Button>
            </a>
          </div>
        </Card>
      </Col>
    </Row>
  </div>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import {
    Card,
    Tag,
    Badge,
    Button,
    Row,
    Col,
  } from 'ant-design-vue';
  import {
    CloudServerOutlined,
    RocketOutlined,
    LinkOutlined,
    SafetyCertificateOutlined,
    ApartmentOutlined,
    DatabaseOutlined,
    ApiOutlined,
  } from '@ant-design/icons-vue';

  defineOptions({
    name: 'DashboardWelcome',
  });

  interface CloudServiceItem {
    name: string;
    category: string;
    categoryColor: string;
    description: string;
    tags: string[];
    website: string;
  }

  const cloudServices = ref<CloudServiceItem[]>([
    {
      name: 'Infisical',
      category: '环境机密管理',
      categoryColor: 'purple',
      description: '全托管云端机密管理中心，集中管理并自动热注入 MySQL、Redis、Cloudflare 全部 Token，彻底杜绝代码密钥泄露。',
      tags: ['机密管理', 'E2EE 加密', '多环境动态下发'],
      website: 'https://infisical.com/',
    },
    {
      name: 'Cloudflare Vectorize',
      category: '向量数据库 (Vector DB)',
      categoryColor: 'blue',
      description: '全球分布式 Serverless 向量数据库，存储知识库切片稠密向量，实现毫秒级余弦相似度召回与 ACL 权限隔离检索。',
      tags: ['word-embeddings', '1024 维', 'Cosine 度量'],
      website: 'https://developers.cloudflare.com/vectorize/',
    },
    {
      name: 'Cloudflare Workers AI',
      category: 'AI 嵌入模型算力',
      categoryColor: 'cyan',
      description: '全球边缘 Serverless GPU 推理集群，采用标准 OpenAI 兼容协议实时运行高质量多语言向量嵌入模型。',
      tags: ['@cf/baai/bge-m3', 'OpenAI 协议', '边缘 GPU'],
      website: 'https://developers.cloudflare.com/workers-ai/',
    },
    {
      name: 'Cloudflare R2',
      category: '对象存储 (Object Storage)',
      categoryColor: 'orange',
      description: 'S3 兼容的高可用分布式文件存储，零出口流量费，承载文档管理模块的 PDF、Word 原文件预签名秒级直传。',
      tags: ['S3 兼容', '0 流量费', '预签名直传'],
      website: 'https://www.cloudflare.com/developer-platform/r2/',
    },
    {
      name: 'TiDB Cloud',
      category: '关系型数据库 (MySQL)',
      categoryColor: 'geekblue',
      description: '全托管分布式 Serverless MySQL 兼容数据库，支撑用户权限、组织架构、审批记录与三路异步任务状态流水。',
      tags: ['MySQL 兼容', 'Serverless 扩缩容', 'SSL 加密'],
      website: 'https://tidbcloud.com/',
    },
    {
      name: 'Upstash Redis',
      category: '云缓存与限流 (Redis)',
      categoryColor: 'red',
      description: '全球 Serverless Redis 内存数据库，驱动分布式 Token 会话鉴权、高频限流防刷、WebSocket 适配器与任务锁。',
      tags: ['Serverless Redis', 'TLS/SSL', '低延迟缓存'],
      website: 'https://upstash.com/',
    },
    {
      name: 'CloudAMQP',
      category: '消息队列 (RabbitMQ)',
      categoryColor: 'volcano',
      description: '全托管高可用 RabbitMQ 消息总线，通过 Topic 主题模式驱动文档异步解析与三路衍生（向量/全文/图谱）削峰调度。',
      tags: ['RabbitMQ', 'Topic 交换机', '死信队列隔离'],
      website: 'https://www.cloudamqp.com/',
    },
    {
      name: 'Bonsai OpenSearch',
      category: '全文检索引擎 (ES/OS)',
      categoryColor: 'cyan',
      description: '全托管高性能 OpenSearch 集群，采用 smartcn 工业级中文分词与 BM25 倒排索引，支撑 RAG 混合检索精准关键词召回。',
      tags: ['OpenSearch 3.9', 'smartcn 分词', 'BM25 倒排索引'],
      website: 'https://bonsai.io/',
    },
    {
      name: 'MongoDB Atlas',
      category: '文档大文本库 (NoSQL)',
      categoryColor: 'green',
      description: '全托管分布式文档数据库，存储大体积 Markdown 解析全文与切片元数据，避免超大 Payload 阻塞消息队列。',
      tags: ['Markdown 全文', '多模态快照', '高并发查询'],
      website: 'https://www.mongodb.com/cloud/atlas',
    },
  ]);
</script>

<style lang="less" scoped>
  .welcome-container {
    width: 100%;
    min-height: 100%;
    padding: 16px;
    background-color: #f0f2f5;

    .welcome-banner {
      padding: 24px 32px;
      margin-bottom: 16px;
      background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
      border-radius: 8px;
      color: #fff;
      box-shadow: 0 4px 12px rgba(24, 144, 255, 0.15);

      .banner-content {
        max-width: 100%;

        .banner-title {
          display: flex;
          align-items: center;
          font-size: 22px;
          font-weight: 600;
          margin-bottom: 10px;

          .banner-icon {
            margin-right: 10px;
            font-size: 24px;
          }
        }

        .banner-subtitle {
          font-size: 14px;
          line-height: 1.6;
          opacity: 0.92;
          margin-bottom: 14px;
        }

        .banner-badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
      }
    }

    .pipeline-summary-row {
      margin-bottom: 16px;

      .summary-metric-card {
        background: #fff;
        border-radius: 8px;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

        .metric-icon {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;

          &.security-icon {
            background: #f9f0ff;
            color: #722ed1;
          }

          &.ai-icon {
            background: #e6fffb;
            color: #13c2c2;
          }

          &.storage-icon {
            background: #e6f7ff;
            color: #1890ff;
          }

          &.mq-icon {
            background: #fff2e8;
            color: #fa541c;
          }
        }

        .metric-text {
          display: flex;
          flex-direction: column;

          .metric-label {
            font-size: 12px;
            color: rgba(0, 0, 0, 0.45);
            margin-bottom: 2px;
          }

          .metric-value {
            font-size: 15px;
            font-weight: 600;
            color: rgba(0, 0, 0, 0.85);
          }
        }
      }
    }

    .section-title {
      display: flex;
      align-items: center;
      font-size: 16px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.85);
      margin-bottom: 16px;
    }

    .service-card {
      border-radius: 8px;
      transition: all 0.3s;
      height: 100%;
      display: flex;
      flex-direction: column;

      &:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
      }

      :deep(.ant-card-head) {
        border-bottom: 1px solid #f0f0f0;
        padding: 0 16px;
      }

      :deep(.ant-card-body) {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 16px;
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: 8px;

        .service-title {
          font-size: 15px;
          font-weight: 600;
          color: rgba(0, 0, 0, 0.85);
        }
      }

      .service-body {
        .service-desc {
          font-size: 13px;
          color: rgba(0, 0, 0, 0.65);
          line-height: 1.5;
          margin-bottom: 12px;
          min-height: 58px;
        }

        .service-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-bottom: 12px;

          .spec-tag {
            font-size: 12px;
            background: #fafafa;
            border-color: #d9d9d9;
            color: #595959;
          }
        }
      }

      .card-footer {
        padding-top: 8px;
        border-top: 1px dashed #f0f0f0;
        display: flex;
        justify-content: flex-end;

        .link-btn {
          font-size: 12px;
        }
      }
    }
  }
</style>
