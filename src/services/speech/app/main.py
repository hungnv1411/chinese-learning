from fastapi import FastAPI

app = FastAPI(title="speech")


@app.get("/healthz")
def healthz() -> dict[str, bool]:
    return {"ok": True}
