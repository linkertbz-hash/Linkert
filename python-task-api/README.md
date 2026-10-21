# TaskBoard API — independent Python demo

An original, educational CRUD API built to demonstrate Python backend skills. It does not contain source code or business logic copied from AVEXIUM, Finansteh or Parser.

## Stack

Python 3.12+, FastAPI, Pydantic, SQLite, pytest and Docker.

## Local run

1. Create/activate a Python virtual environment.
2. Run `pip install -r requirements.txt`.
3. Run `uvicorn app.main:app --reload`.
4. Visit `http://127.0.0.1:8000/docs`.

## Tests

`python -m pytest -q`

## Routes

- `GET /health`
- `POST /tasks`
- `GET /tasks` (optional `status`, `limit`, `offset`)
- `GET /tasks/{task_id}`
- `PATCH /tasks/{task_id}`
- `DELETE /tasks/{task_id}`

This sample has no authentication and is **not production-ready**. Do not deploy it publicly without security, authorization and monitoring controls.
