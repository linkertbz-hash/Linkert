"""HTTP tests with fresh SQLite database per test."""

from fastapi.testclient import TestClient
import pytest
from app.main import create_app


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / "test.db")) as api:
        yield api


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_task_lifecycle(client):
    response = client.post("/tasks", json={"title": "Learn Python", "description": "Tests"})
    assert response.status_code == 201
    task = response.json()
    assert task["status"] == "todo"
    assert client.get(f"/tasks/{task['id']}").status_code == 200
    assert len(client.get("/tasks").json()) == 1

    changed = client.patch(f"/tasks/{task['id']}", json={"status": "done"})
    assert changed.status_code == 200
    assert changed.json()["status"] == "done"
    assert len(client.get("/tasks?status=done").json()) == 1
    assert client.get("/tasks?status=todo").json() == []

    assert client.delete(f"/tasks/{task['id']}").status_code == 204
    assert client.get(f"/tasks/{task['id']}").status_code == 404


def test_validation(client):
    assert client.post("/tasks", json={"title": ""}).status_code == 422
    assert client.post("/tasks", json={"title": "    "}).status_code == 422
    assert client.post("/tasks", json={"title": "good", "admin": True}).status_code == 422
    r = client.post("/tasks", json={"title": "demo"})
    tid = r.json()["id"]
    assert client.patch(f"/tasks/{tid}", json={"title": "  "}).status_code == 422
    assert client.patch(f"/tasks/{tid}", json={"status": "bad"}).status_code == 422
    assert client.patch(f"/tasks/{tid}", json={"title": None}).status_code == 422
    assert client.patch(f"/tasks/{tid}", json={"description": "safe", "unknown": 1}).status_code == 422


def test_missing_task(client):
    assert client.get("/tasks/99999").status_code == 404
    assert client.patch("/tasks/99999", json={"status": "done"}).status_code == 404
    assert client.delete("/tasks/99999").status_code == 404


def test_filter_and_pagination(client):
    for i in range(4):
        client.post("/tasks", json={"title": f"Task {i}"})
    page1 = client.get("/tasks?limit=2&offset=0").json()
    page2 = client.get("/tasks?limit=2&offset=2").json()
    assert len(page1) == len(page2) == 2
    assert not {t["id"] for t in page1} & {t["id"] for t in page2}
    assert client.get("/tasks?limit=200").status_code == 422
