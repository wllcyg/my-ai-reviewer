"""
Infisical 远端云端配置中心加载器 (Remote Secret Store)
实现与 NestJS 端对齐的动态配置加载能力：
在应用启动/配置初始化前，通过 Universal Auth 从私有 Infisical 拉取最新密钥并注入至 os.environ
"""

import logging
import os
from typing import Dict, Optional
import httpx

logger = logging.getLogger("core.infisical")

# 默认私有配置中心地址
DEFAULT_SITE_URL = "https://env.cheatppf.xyz"


def load_infisical_secrets(force_reload: bool = False) -> Dict[str, str]:
    """
    从私有 Infisical 云端拉取最新环境变量并注入到 os.environ
    若缺少引导密钥或网络异常，则安全降级回退至本地现有环境变量
    """
    site_url = os.getenv("INFISICAL_SITE_URL", DEFAULT_SITE_URL).rstrip("/")
    client_id = os.getenv("INFISICAL_CLIENT_ID")
    client_secret = os.getenv("INFISICAL_CLIENT_SECRET")
    project_id = os.getenv("INFISICAL_PROJECT_ID")
    environment = os.getenv("INFISICAL_ENVIRONMENT") or (
        "prod" if os.getenv("APP_ENV") == "production" else "dev"
    )

    # 检查引导凭据
    if not client_id or not client_secret or not project_id:
        logger.info("未配置 INFISICAL 引导密钥，使用本地已有环境变量启动")
        return {}

    try:
        logger.info(f"正在从云端配置中心 [{site_url}] 同步环境 [{environment}] 密钥...")

        with httpx.Client(timeout=5.0) as client:
            # 1. Universal Auth 身份认证
            login_resp = client.post(
                f"{site_url}/api/v1/auth/universal-auth/login",
                json={
                    "clientId": client_id,
                    "clientSecret": client_secret,
                },
            )
            login_resp.raise_for_status()
            access_token = login_resp.json().get("accessToken")

            if not access_token:
                logger.warning("Infisical 认证返回缺少 accessToken，回退本地环境")
                return {}

            # 2. 拉取全量 Secret 字典
            secrets_resp = client.get(
                f"{site_url}/api/v3/secrets/raw",
                params={
                    "workspaceId": project_id,
                    "environment": environment,
                },
                headers={
                    "Authorization": f"Bearer {access_token}",
                },
            )
            secrets_resp.raise_for_status()
            raw_secrets = secrets_resp.json().get("secrets", [])

            injected_count = 0
            loaded: Dict[str, str] = {}

            # 3. 动态注入到 os.environ (与 Nest 端 attachToProcessEnv 行为一致)
            for item in raw_secrets:
                k = item.get("secretKey")
                v = item.get("secretValue")
                if k and v is not None:
                    # 允许云端变量注入或覆盖
                    if force_reload or k not in os.environ:
                        os.environ[k] = str(v)
                        injected_count += 1
                    loaded[k] = str(v)

            logger.info(f"✓ 云端配置同步成功，共获取 {len(raw_secrets)} 个变量，动态注入 {injected_count} 项")
            return loaded

    except Exception as e:
        logger.warning(
            f"✗ 从 Infisical 同步云端配置失败: {e}，将回退使用本地环境变量",
            exc_info=False,
        )
        return {}
