"""Obsidian Local REST API HTTP 客户端"""

from __future__ import annotations

import os
from urllib.parse import quote

import httpx

DEFAULT_API_URL = "http://localhost:27123"


def _encode_path(path: str) -> str:
    return "/".join(quote(seg) for seg in path.split("/"))


class ObsidianClient:
    """Obsidian REST API 客户端"""

    def __init__(self, api_url: str | None = None) -> None:
        self._base_url = (api_url or os.getenv("OBSIDIAN_API_URL") or DEFAULT_API_URL).rstrip("/")

    async def get_note(self, path: str) -> str | None:
        try:
            url = f"{self._base_url}/vault/{_encode_path(path)}"
            async with httpx.AsyncClient() as client:
                res = await client.get(url)
            if not res.is_success:
                return None
            return res.text
        except Exception:
            return None

    async def put_note(self, path: str, content: str) -> bool:
        try:
            url = f"{self._base_url}/vault/{_encode_path(path)}"
            async with httpx.AsyncClient() as client:
                res = await client.put(url, content=content, headers={"Content-Type": "text/markdown"})
            return res.is_success
        except Exception:
            return False

    async def list_dir(self, dir: str | None = None) -> list[str]:
        try:
            url = f"{self._base_url}/vault/{_encode_path(dir)}/" if dir else f"{self._base_url}/vault/"
            async with httpx.AsyncClient() as client:
                res = await client.get(url)
            if not res.is_success:
                return []
            body = res.json()
            return [f["name"] for f in body.get("files", [])]
        except Exception:
            return []
