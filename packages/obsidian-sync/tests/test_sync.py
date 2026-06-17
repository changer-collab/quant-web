"""SyncService 测试"""

from quantforge_obsidian.sync import SyncService


def test_disabled_when_no_url():
    svc = SyncService(api_url="")
    assert not svc.enabled


def test_enabled_with_url():
    svc = SyncService(api_url="http://localhost:27123")
    assert svc.enabled
