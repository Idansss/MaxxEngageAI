"""
Credential anchoring.

When IPFS credentials are configured, credentials are pinned as JSON and the
returned CID is written into the credential. Without IPFS, we still write a
deterministic SHA-256 content hash so verifiers can detect tampering.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass

import httpx

from app.core.config import get_settings
from app.core.logging import logger


@dataclass
class AnchorResult:
    content_hash: str
    provider: str
    status: str
    ipfs_cid: str | None = None
    anchor_url: str | None = None
    error: str | None = None


def canonical_json_bytes(document: dict) -> bytes:
    return json.dumps(document, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


async def anchor_credential(document: dict, credential_id: str) -> AnchorResult:
    settings = get_settings()
    payload = canonical_json_bytes(document)
    content_hash = hashlib.sha256(payload).hexdigest()

    if not settings.ipfs_pinata_jwt:
        return AnchorResult(
            content_hash=content_hash,
            provider="sha256",
            status="hashed_only",
            anchor_url=f"urn:sha256:{content_hash}",
        )

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=8.0)) as client:
            resp = await client.post(
                "https://api.pinata.cloud/pinning/pinJSONToIPFS",
                headers={
                    "Authorization": f"Bearer {settings.ipfs_pinata_jwt}",
                    "Content-Type": "application/json",
                },
                json={
                    "pinataMetadata": {
                        "name": f"maxx-engage-credential-{credential_id}.json",
                        "keyvalues": {
                            "credential_id": credential_id,
                            "content_hash": content_hash,
                            "project": "maxx-engage",
                        },
                    },
                    "pinataContent": document,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            cid = data.get("IpfsHash")
            if not cid:
                raise ValueError("Pinata response did not include IpfsHash.")
            gateway = settings.ipfs_gateway_url.rstrip("/")
            return AnchorResult(
                content_hash=content_hash,
                provider="pinata_ipfs",
                status="pinned",
                ipfs_cid=cid,
                anchor_url=f"{gateway}/{cid}",
            )
    except Exception as exc:
        logger.warning("credential.anchor_failed", credential_id=credential_id, error=str(exc))
        return AnchorResult(
            content_hash=content_hash,
            provider="pinata_ipfs",
            status="failed",
            anchor_url=f"urn:sha256:{content_hash}",
            error=str(exc),
        )
