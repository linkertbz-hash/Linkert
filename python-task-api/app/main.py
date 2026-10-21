"""Self-contained educational TaskBoard API, with no commercial code."""

from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timezone
import os
from pathlib import Path
import sqlite3
from typing import Annotated, Iterator, Literal

from fastapi import FastAPI, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field

TaskStatus = Literal["todo", "doing", "done"]


class TaskInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=2000)


class TaskPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    status: TaskStatus | None = None


class Task(TaskInput):
    id: int
    status: TaskStatus
    created_at: str
    updated_at: str


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect(db_path: Path) -> sqlite3.Connection:
    db = sqlite3.connect(db_path, timeout=10)
    db.row_factory = sqlite3.Row
    return db


@contextmanager
def connection(db_path: Path) -> Iterator[sqlite3.Connection]:
    db = connect(db_path)
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def create_app(database_path: str | Path = "tasks.db") -> FastAPI:
    path = Path(database_path)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        path.parent.mkdir(parents=True, exist_ok=True)
        with connection(path) as db:
            db.execute("""CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'todo',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )""")
        yield

    api = FastAPI(title="TaskBoard API", version="1.0", lifespan=lifespan)

    def find_task(task_id: int) -> dict:
        with connection(path) as db:
            row = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Task not found")
        return dict(row)

    @api.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    @api.post("/tasks", response_model=Task, status_code=status.HTTP_201_CREATED)
    def create_task(payload: TaskInput) -> dict:
        if not payload.title.strip():
            raise HTTPException(status_code=422, detail="Title cannot be blank")
        timestamp = now_utc()
        with connection(path) as db:
            cursor = db.execute(
                "INSERT INTO tasks (title, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (payload.title.strip(), payload.description, "todo", timestamp, timestamp),
            )
            task_id = cursor.lastrowid
        return find_task(task_id)

    @api.get("/tasks", response_model=list[Task])
    def list_tasks(
        status_filter: Annotated[TaskStatus | None, Query(alias="status")] = None,
        limit: Annotated[int, Query(ge=1, le=100)] = 50,
        offset: Annotated[int, Query(ge=0)] = 0,
    ) -> list[dict]:
        with connection(path) as db:
            if status_filter is None:
                rows = db.execute("SELECT * FROM tasks ORDER BY id DESC LIMIT ? OFFSET ?", (limit, offset))
            else:
                rows = db.execute(
                    "SELECT * FROM tasks WHERE status = ? ORDER BY id DESC LIMIT ? OFFSET ?",
                    (status_filter, limit, offset),
                )
            return [dict(row) for row in rows.fetchall()]

    @api.get("/tasks/{task_id}", response_model=Task)
    def get_task(task_id: int) -> dict:
        return find_task(task_id)

    @api.patch("/tasks/{task_id}", response_model=Task)
    def patch_task(task_id: int, payload: TaskPatch) -> dict:
        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            return find_task(task_id)
        if any(value is None for value in updates.values()):
            raise HTTPException(status_code=422, detail="Fields cannot be null")
        if "title" in updates:
            updates["title"] = updates["title"].strip()
            if not updates["title"]:
                raise HTTPException(status_code=422, detail="Title cannot be blank")
        updates["updated_at"] = now_utc()
        columns = ", ".join(f"{name} = ?" for name in updates)
        with connection(path) as db:
            cursor = db.execute(
                f"UPDATE tasks SET {columns} WHERE id = ?",
                (*updates.values(), task_id),
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Task not found")
        return find_task(task_id)

    @api.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_task(task_id: int) -> Response:
        with connection(path) as db:
            cursor = db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Task not found")
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return api


app = create_app(os.environ.get("TASKBOARD_DB", "tasks.db"))
