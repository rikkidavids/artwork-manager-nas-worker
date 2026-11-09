"""Weak or placeholder API tokens are called out in the app status."""
import pytest


@pytest.mark.parametrize('token,expect', [
    ('', 'No access token'),
    ('change-me', 'placeholder'),
    ('use-a-private-token-here', 'placeholder'),
    ('abc123', 'very short'),
    ('a-long-private-token-1234', ''),
])
def test_token_warning(nas, monkeypatch, token, expect):
    mod, _music = nas
    monkeypatch.setattr(mod, 'API_TOKEN', token)
    warning = mod.token_warning()
    assert (expect in warning) if expect else warning == ''
    assert mod.web_status_payload()['web_app']['token_warning'] == warning
