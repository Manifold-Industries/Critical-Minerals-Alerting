from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_root_returns_service_name() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"service": "Critical Minerals Alerting API"}


def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
