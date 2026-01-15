from __future__ import annotations

import os
import json
import subprocess
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Literal

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from docxtpl import DocxTemplate

# Google Drive
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from pydantic import BaseModel

import pymysql

# =========================
# Config
# =========================
MYSQL_HOST = "127.0.0.1" # os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = 3308 # int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_DB   = "cutlaguna" # os.getenv("MYSQL_DB", "cutlaguna")
MYSQL_USER = "cut_user" # os.getenv("MYSQL_USER", "cut_user")
MYSQL_PASS = "cutlaguna" # os.getenv("MYSQL_PASS", "cutlaguna")

print("DB CFG =>", {
  "MYSQL_HOST": MYSQL_HOST,
  "MYSQL_PORT": MYSQL_PORT,
  "MYSQL_DB": MYSQL_DB,
  "MYSQL_USER": MYSQL_USER,
  "MYSQL_PASS_set": bool(MYSQL_PASS),
})


# Si después quieres quitar el prefijo cut_, cambia esto a "" y renombra tablas
TABLE_PREFIX = ""

# Drive config (Service Account)
GDRIVE_ENABLED = os.getenv("GDRIVE_ENABLED", "0") == "1"
GDRIVE_SERVICE_ACCOUNT_JSON = os.getenv("GDRIVE_SERVICE_ACCOUNT_JSON", "")
GDRIVE_PARENT_FOLDER_ID = os.getenv("GDRIVE_PARENT_FOLDER_ID", "")

# LibreOffice binary
#SOFFICE_BIN = os.getenv("SOFFICE_BIN", "soffice")  # Mac: /Applications/LibreOffice.app/Contents/MacOS/soffice
SOFFICE_BIN = os.getenv(
    "SOFFICE_BIN",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice"
)

BASE_DIR = Path(__file__).resolve().parent
TEMPLATE_DIR = BASE_DIR / "template"
STORAGE_DIR = BASE_DIR / "storage"
OUT_DIR = STORAGE_DIR / "out"
UPLOADS_DIR = STORAGE_DIR / "uploads"

TOKENS_FILE = BASE_DIR / "template_tokens.json"
TEMPLATE_FILE = TEMPLATE_DIR / "contrato_template.docx"


def db():
    return pymysql.connect(
        host=MYSQL_HOST, port=MYSQL_PORT,
        user=MYSQL_USER, password=MYSQL_PASS,
        database=MYSQL_DB, charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True
    )


def ensure_dirs() -> None:
    for d in [TEMPLATE_DIR, STORAGE_DIR, OUT_DIR, UPLOADS_DIR]:
        d.mkdir(parents=True, exist_ok=True)


def load_token_map() -> Dict[str, str]:
    if not TOKENS_FILE.exists():
        raise RuntimeError(f"No existe {TOKENS_FILE}.")
    return json.loads(TOKENS_FILE.read_text(encoding="utf-8"))


def render_docx(context: Dict[str, object], out_docx: Path) -> None:
    if not TEMPLATE_FILE.exists():
        raise RuntimeError(
            f"No existe la plantilla {TEMPLATE_FILE}.\n"
            "1) Copia tu machote a template/contrato_template.docx\n"
            "2) Reemplaza los espacios/guiones por tokens {{TOKEN}}\n"
            "3) Tokens: template_tokens.json"
        )
    doc = DocxTemplate(str(TEMPLATE_FILE))
    doc.render(context)
    doc.save(str(out_docx))


def convert_to_pdf(docx_path: Path, out_dir: Path) -> Path:
    cmd = [
        SOFFICE_BIN,
        "--headless",
        "--nologo",
        "--nofirststartwizard",
        "--convert-to", "pdf",
        "--outdir", str(out_dir),
        str(docx_path),
    ]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"Error convirtiendo a PDF.\nSTDOUT:\n{p.stdout}\nSTDERR:\n{p.stderr}")

    pdf_path = out_dir / (docx_path.stem + ".pdf")
    if not pdf_path.exists():
        raise RuntimeError("La conversión terminó pero no se encontró el PDF esperado.")
    return pdf_path


# =========================
# Google Drive helpers
# =========================
def drive_folder_url(folder_id: str) -> str:
    return f"https://drive.google.com/drive/folders/{folder_id}"

def drive_file_view_url(file_id: str) -> str:
    return f"https://drive.google.com/file/d/{file_id}/view"

def drive_client():
    if not GDRIVE_ENABLED:
        return None
    if not GDRIVE_SERVICE_ACCOUNT_JSON:
        raise RuntimeError("GDRIVE_ENABLED=1 pero falta GDRIVE_SERVICE_ACCOUNT_JSON (path al JSON).")

    scopes = ["https://www.googleapis.com/auth/drive"]
    creds = Credentials.from_service_account_file(GDRIVE_SERVICE_ACCOUNT_JSON, scopes=scopes)
    return build("drive", "v3", credentials=creds)


def drive_mkdir(service, name: str, parent_id: Optional[str]) -> str:
    meta = {"name": name, "mimeType": "application/vnd.google-apps.folder"}
    if parent_id:
        meta["parents"] = [parent_id]
    folder = service.files().create(body=meta, fields="id", supportsAllDrives=True).execute()
    return folder["id"]


def drive_upload_file(service, filepath: Path, parent_id: str, mime: str) -> str:
    media = MediaFileUpload(str(filepath), mimetype=mime, resumable=True)
    body = {"name": filepath.name, "parents": [parent_id]}
    f = service.files().create(
        body=body,
        media_body=media,
        fields="id",
        supportsAllDrives=True
    ).execute()
    return f["id"]


# =========================
# FastAPI app
# =========================
app = FastAPI(title="CUT Contratos API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ajusta a tu dominio en producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sirve el HTML en /ui (pon tu index.html al lado de main.py o en BASE_DIR)
app.mount("/ui", StaticFiles(directory=str(BASE_DIR), html=True), name="static")
# Sirve generados en /files/...
app.mount("/files", StaticFiles(directory=str(OUT_DIR)), name="files_out")


@app.get("/health")
def health():
    return {"ok": True, "ts": datetime.utcnow().isoformat() + "Z"}


# =========================================================
# CONTRATOS / EXPEDIENTES
# =========================================================
@app.get("/api/contracts")
def search_contracts(search: str = "", page: int = 1, page_size: int = 20):
    page = max(1, int(page))
    page_size = min(100, max(1, int(page_size)))
    offset = (page - 1) * page_size

    s = (search or "").strip()
    like = f"%{s}%"

    t_prof = f"{TABLE_PREFIX}profesionistas"
    t_cont = f"{TABLE_PREFIX}contratos"

    try:
        conn = db()
        with conn.cursor() as cur:
            if s:
                cur.execute(f"""
                    SELECT COUNT(*) AS total
                    FROM {t_prof} p
                    WHERE p.rfc LIKE %s OR p.nombre LIKE %s OR p.email LIKE %s OR p.telefono LIKE %s
                """, (like, like, like, like))
            else:
                cur.execute(f"SELECT COUNT(*) AS total FROM {t_prof} p")

            total = int(cur.fetchone()["total"])

            if s:
                cur.execute(f"""
                    SELECT
                      p.id AS profesionista_id,
                      p.rfc, p.nombre, p.email, p.telefono,
                      c.id AS contrato_id,
                      c.run_id, c.created_at,
                      c.servicio_periodo, c.servicio_carrera, c.servicio_materia,
                      c.local_pdf_url, c.local_docx_url,
                      c.drive_folder_url, c.drive_pdf_view_url
                    FROM {t_prof} p
                    LEFT JOIN {t_cont} c
                      ON c.id = (
                        SELECT c2.id
                        FROM {t_cont} c2
                        WHERE c2.profesionista_id = p.id
                        ORDER BY c2.created_at DESC
                        LIMIT 1
                      )
                    WHERE p.rfc LIKE %s OR p.nombre LIKE %s OR p.email LIKE %s OR p.telefono LIKE %s
                    ORDER BY p.nombre ASC
                    LIMIT %s OFFSET %s
                """, (like, like, like, like, page_size, offset))
            else:
                cur.execute(f"""
                    SELECT
                      p.id AS profesionista_id,
                      p.rfc, p.nombre, p.email, p.telefono,
                      c.id AS contrato_id,
                      c.run_id, c.created_at,
                      c.servicio_periodo, c.servicio_carrera, c.servicio_materia,
                      c.local_pdf_url, c.local_docx_url,
                      c.drive_folder_url, c.drive_pdf_view_url
                    FROM {t_prof} p
                    LEFT JOIN {t_cont} c
                      ON c.id = (
                        SELECT c2.id
                        FROM {t_cont} c2
                        WHERE c2.profesionista_id = p.id
                        ORDER BY c2.created_at DESC
                        LIMIT 1
                      )
                    ORDER BY p.nombre ASC
                    LIMIT %s OFFSET %s
                """, (page_size, offset))

            rows = cur.fetchall()

            for r in rows:
                if r.get("created_at"):
                    r["created_at"] = r["created_at"].isoformat()

            return {
                "ok": True,
                "search": s,
                "page": page,
                "page_size": page_size,
                "total": total,
                "pages": (total + page_size - 1) // page_size,
                "items": rows
            }
    finally:
        try:
            conn.close()
        except:
            pass


@app.get("/api/contracts/recent")
def recent_contracts(limit: int = 30):
    limit = min(200, max(1, int(limit)))

    t_prof = f"{TABLE_PREFIX}profesionistas"
    t_cont = f"{TABLE_PREFIX}contratos"

    try:
        conn = db()
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT
                  c.id AS contrato_id,
                  c.run_id,
                  c.created_at,
                  p.rfc, p.nombre, p.email, p.telefono,
                  c.servicio_periodo, c.servicio_carrera, c.servicio_materia,
                  c.local_pdf_url, c.drive_pdf_view_url, c.drive_folder_url
                FROM {t_cont} c
                JOIN {t_prof} p ON p.id = c.profesionista_id
                ORDER BY c.created_at DESC
                LIMIT %s
            """, (limit,))
            rows = cur.fetchall()

            for r in rows:
                if r.get("created_at"):
                    r["created_at"] = r["created_at"].isoformat()

            return {"ok": True, "limit": limit, "items": rows}
    finally:
        try:
            conn.close()
        except:
            pass


@app.post("/api/contracts/generate")
async def generate_contract(
    # Datos profesionista
    profesionista_nombre: str = Form(...),
    profesionista_nacionalidad: str = Form("Mexicana"),
    profesionista_rfc: str = Form(...),
    profesionista_curp: str = Form(...),
    profesionista_email: str = Form(...),
    profesionista_telefono: str = Form(...),
    profesionista_domicilio_fiscal: str = Form(...),

    # Datos servicio/pago
    servicio_periodo: str = Form(...),
    servicio_carrera: str = Form(...),
    servicio_materia: str = Form(...),
    servicio_categoria: str = Form(""),
    pago_horas: Optional[int] = Form(None),
    pago_por_hora: Optional[float] = Form(None),
    pago_total_semestre: Optional[float] = Form(None),
    pago_total_letra: str = Form(""),

    # Archivos
    file_ine_frente: UploadFile = File(...),
    file_ine_vuelta: Optional[UploadFile] = File(None),
    file_comprobante: UploadFile = File(...),
    file_curp: UploadFile = File(...),
    file_constancia_fiscal: Optional[UploadFile] = File(None),
):
    ensure_dirs()

    token_map = load_token_map()

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:8]
    safe_name = "".join([c for c in profesionista_nombre if c.isalnum() or c in " _-"]).strip().replace(" ", "_")
    folder_name = f"{safe_name}_{profesionista_rfc}"
    local_run_dir = OUT_DIR / folder_name
    local_run_dir.mkdir(parents=True, exist_ok=True)

    uploads_dir = UPLOADS_DIR / folder_name
    uploads_dir.mkdir(parents=True, exist_ok=True)

    async def save_upload(u: UploadFile, target: Path) -> None:
        with target.open("wb") as f:
            while True:
                chunk = await u.read(1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)

    # Guardar anexos
    await save_upload(file_ine_frente, uploads_dir / f"INE_FRENTE{Path(file_ine_frente.filename).suffix}")
    if file_ine_vuelta:
        await save_upload(file_ine_vuelta, uploads_dir / f"INE_VUELTA{Path(file_ine_vuelta.filename).suffix}")
    await save_upload(file_comprobante, uploads_dir / f"COMPROBANTE{Path(file_comprobante.filename).suffix}")
    await save_upload(file_curp, uploads_dir / f"CURP{Path(file_curp.filename).suffix}")
    if file_constancia_fiscal:
        await save_upload(file_constancia_fiscal, uploads_dir / f"CSF{Path(file_constancia_fiscal.filename).suffix}")

    # Datos (incluye fecha)
    data = {
        "profesionista_nombre": profesionista_nombre,
        "profesionista_nacionalidad": profesionista_nacionalidad,
        "profesionista_domicilio_fiscal": profesionista_domicilio_fiscal,
        "profesionista_rfc": profesionista_rfc,
        "profesionista_curp": profesionista_curp,
        "profesionista_email": profesionista_email,
        "profesionista_telefono": profesionista_telefono,

        "servicio_periodo": servicio_periodo,
        "servicio_carrera": servicio_carrera,
        "servicio_materia": servicio_materia,
        "servicio_categoria": servicio_categoria,

        "pago_horas": pago_horas if pago_horas is not None else "",
        "pago_por_hora": f"{pago_por_hora:.2f}" if pago_por_hora is not None else "",
        "pago_total_semestre": f"{pago_total_semestre:.2f}" if pago_total_semestre is not None else "",
        "pago_total_letra": pago_total_letra,
        "fecha_hoy": datetime.now().strftime("%d/%m/%Y"),
    }

    # Contexto para docxtpl: TOKEN -> valor
    context: Dict[str, object] = {}
    for token, field_name in token_map.items():
        context[token] = data.get(field_name, "")

    # DOCX
    out_docx = local_run_dir / f"Contrato_{safe_name}_{profesionista_rfc}.docx"
    try:
        render_docx(context, out_docx)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # PDF
    try:
        out_pdf = convert_to_pdf(out_docx, local_run_dir)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Drive
    drive_info = None
    if GDRIVE_ENABLED:
        try:
            service = drive_client()

            folder_id = drive_mkdir(service, folder_name, GDRIVE_PARENT_FOLDER_ID or None)
            docs_folder_id = drive_mkdir(service, "Documentos", folder_id)

            docx_id = drive_upload_file(
                service, out_docx, folder_id,
                mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
            pdf_id = drive_upload_file(service, out_pdf, folder_id, mime="application/pdf")

            attachments = []
            for p in uploads_dir.iterdir():
                att_id = drive_upload_file(service, p, docs_folder_id, mime="application/octet-stream")
                attachments.append({
                    "name": p.name,
                    "id": att_id,
                    "view_url": drive_file_view_url(att_id),
                })

            service.files().get(fileId=pdf_id, fields="id,name,parents", supportsAllDrives=True).execute()

            drive_info = {
                "folder_name": folder_name,
                "folder_id": folder_id,
                "folder_url": drive_folder_url(folder_id),
                "docs_folder_id": docs_folder_id,
                "docs_folder_url": drive_folder_url(docs_folder_id),
                "docx_file_id": docx_id,
                "docx_view_url": drive_file_view_url(docx_id),
                "pdf_file_id": pdf_id,
                "pdf_view_url": drive_file_view_url(pdf_id),
                "attachments": attachments,
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Fallo subida a Google Drive: {e}")

    # Persistencia MySQL (siempre, aunque no uses Drive)
    t_prof = f"{TABLE_PREFIX}profesionistas"
    t_cont = f"{TABLE_PREFIX}contratos"
    t_adj  = f"{TABLE_PREFIX}contrato_adjuntos"

    try:
        conn = db()
        with conn.cursor() as cur:
            # 1) UPSERT profesionista por RFC
            cur.execute(f"""
                INSERT INTO {t_prof}
                (rfc, nombre, curp, nacionalidad, email, telefono, domicilio_fiscal)
                VALUES
                (%s,%s,%s,%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE
                nombre=VALUES(nombre),
                curp=VALUES(curp),
                nacionalidad=VALUES(nacionalidad),
                email=VALUES(email),
                telefono=VALUES(telefono),
                domicilio_fiscal=VALUES(domicilio_fiscal),
                updated_at=CURRENT_TIMESTAMP
            """, (
                profesionista_rfc, profesionista_nombre, profesionista_curp, profesionista_nacionalidad,
                profesionista_email, profesionista_telefono, profesionista_domicilio_fiscal
            ))

            # 2) Obtener profesionista_id
            cur.execute(f"SELECT id FROM {t_prof} WHERE rfc=%s LIMIT 1", (profesionista_rfc,))
            prof = cur.fetchone()
            profesionista_id = prof["id"]

            # 3) Insert contrato (run)
            cur.execute(f"""
                INSERT INTO {t_cont}
                (profesionista_id, run_id,
                servicio_periodo, servicio_carrera, servicio_materia, servicio_categoria,
                pago_horas, pago_por_hora, pago_total_semestre, pago_total_letra,
                local_folder, local_docx_url, local_pdf_url,
                drive_folder_id, drive_folder_url, drive_docs_folder_id, drive_docs_folder_url,
                drive_docx_file_id, drive_docx_view_url, drive_pdf_file_id, drive_pdf_view_url)
                VALUES
                (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                profesionista_id, run_id,
                servicio_periodo, servicio_carrera, servicio_materia, servicio_categoria or None,
                pago_horas, pago_por_hora, pago_total_semestre, pago_total_letra or None,
                folder_name, f"/files/{folder_name}/{out_docx.name}", f"/files/{folder_name}/{out_pdf.name}",
                (drive_info or {}).get("folder_id"),
                (drive_info or {}).get("folder_url"),
                (drive_info or {}).get("docs_folder_id"),
                (drive_info or {}).get("docs_folder_url"),
                (drive_info or {}).get("docx_file_id"),
                (drive_info or {}).get("docx_view_url"),
                (drive_info or {}).get("pdf_file_id"),
                (drive_info or {}).get("pdf_view_url"),
            ))
            contrato_id = cur.lastrowid

            # 4) Adjuntos
            if drive_info and drive_info.get("attachments"):
                for a in drive_info["attachments"]:
                    cur.execute(f"""
                        INSERT INTO {t_adj} (contrato_id, nombre, drive_file_id, drive_view_url)
                        VALUES (%s,%s,%s,%s)
                    """, (contrato_id, a.get("name"), a.get("id"), a.get("view_url")))
    finally:
        try:
            conn.close()
        except:
            pass

    return JSONResponse({
        "ok": True,
        "run_id": run_id,
        "local_docx_url": f"/files/{folder_name}/{out_docx.name}",
        "local_pdf_url": f"/files/{folder_name}/{out_pdf.name}",
        "drive": drive_info,
        "folder": folder_name
    })


# =========================================================
# CATALOGOS (para tu UI: /api/catalogos/carreras|materias|categorias)
# Soft delete = inactivar (NO borrar)
# =========================================================
CatalogType = Literal["carreras", "materias", "categorias"]

CAT_TABLE = {
    "carreras": f"{TABLE_PREFIX}carreras",
    "materias": f"{TABLE_PREFIX}materias",
    "categorias": f"{TABLE_PREFIX}categorias",
}

class CatalogUpsert(BaseModel):
    name: str
    is_active: int = 1  # 1 activo, 0 inactivo

def _cat_table(cat: str) -> str:
    if cat not in CAT_TABLE:
        raise HTTPException(status_code=404, detail="Catálogo inválido")
    return CAT_TABLE[cat]


@app.get("/api/catalogos/{cat}")
def list_catalog(
    cat: CatalogType,
    search: str = "",
    page: int = 1,
    page_size: int = 20,
    include_inactive: int = 1,  # 1 = trae todo, 0 = solo activos
):
    page = max(1, int(page))
    page_size = min(100, max(1, int(page_size)))
    offset = (page - 1) * page_size

    s = (search or "").strip()
    like = f"%{s}%"
    table = _cat_table(cat)

    try:
        conn = db()
        with conn.cursor() as cur:
            where = []
            params = []

            if s:
                where.append("name LIKE %s")
                params.append(like)

            if not int(include_inactive):
                where.append("is_active = 1")

            where_sql = ("WHERE " + " AND ".join(where)) if where else ""

            cur.execute(f"SELECT COUNT(*) AS total FROM {table} {where_sql}", tuple(params))
            total = int(cur.fetchone()["total"])

            cur.execute(
                f"""
                SELECT id, name, is_active, created_at, updated_at
                FROM {table}
                {where_sql}
                ORDER BY name ASC
                LIMIT %s OFFSET %s
                """,
                tuple(params + [page_size, offset])
            )
            rows = cur.fetchall()

            for r in rows:
                if r.get("created_at"):
                    r["created_at"] = r["created_at"].isoformat()
                if r.get("updated_at"):
                    r["updated_at"] = r["updated_at"].isoformat()

            return {
                "ok": True,
                "cat": cat,
                "search": s,
                "page": page,
                "page_size": page_size,
                "total": total,
                "pages": (total + page_size - 1) // page_size,
                "items": rows,
            }
    finally:
        try:
            conn.close()
        except:
            pass


@app.post("/api/catalogos/{cat}")
def create_catalog(cat: CatalogType, payload: CatalogUpsert):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name es obligatorio")

    table = _cat_table(cat)

    try:
        conn = db()
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {table} (name, is_active) VALUES (%s, %s)",
                (name, int(payload.is_active))
            )
            new_id = cur.lastrowid
            return {"ok": True, "id": new_id}
    finally:
        try:
            conn.close()
        except:
            pass


@app.put("/api/catalogos/{cat}/{item_id}")
def update_catalog(cat: CatalogType, item_id: int, payload: CatalogUpsert):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name es obligatorio")

    table = _cat_table(cat)

    try:
        conn = db()
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE {table}
                SET name=%s, is_active=%s, updated_at=CURRENT_TIMESTAMP
                WHERE id=%s
                """,
                (name, int(payload.is_active), int(item_id))
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Registro no encontrado")
            return {"ok": True}
    finally:
        try:
            conn.close()
        except:
            pass


@app.delete("/api/catalogos/{cat}/{item_id}")
def soft_delete_catalog(cat: CatalogType, item_id: int):
    """
    Soft delete = inactivar (NO borrar)
    """
    table = _cat_table(cat)

    try:
        conn = db()
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE {table}
                SET is_active=0, updated_at=CURRENT_TIMESTAMP
                WHERE id=%s
                """,
                (int(item_id),)
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Registro no encontrado")
            return {"ok": True}
    finally:
        try:
            conn.close()
        except:
            pass 

@app.get("/api/db/health")
def db_health():
    try:
        conn = db()
        with conn.cursor() as cur:
            cur.execute("SELECT 1 AS ok")
            r = cur.fetchone()
        conn.close()
        return {
            "ok": True,
            "db": MYSQL_DB,
            "host": MYSQL_HOST,
            "result": r
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/api/db/ping")
def db_ping():
    """
    Verifica:
    - que la app se puede conectar a MySQL/MariaDB
    - que puede leer versión y DB actual
    - y lista usuario/host actual con el que estás conectado
    """
    conn = None
    try:
        conn = db()
        with conn.cursor() as cur:
            cur.execute("SELECT 1 AS ok")
            ok = cur.fetchone()["ok"]

            cur.execute("SELECT VERSION() AS version")
            version = cur.fetchone()["version"]

            cur.execute("SELECT DATABASE() AS db")
            dbname = cur.fetchone()["db"]

            cur.execute("SELECT USER() AS user, CURRENT_USER() AS current_user")
            who = cur.fetchone()

        return {
            "ok": bool(ok == 1),
            "version": version,
            "database": dbname,
            "user": who.get("user"),
            "current_user": who.get("current_user"),
            "host": MYSQL_HOST,
            "port": MYSQL_PORT,
            "db_env": MYSQL_DB,
            "user_env": MYSQL_USER,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            if conn:
                conn.close()
        except:
            pass
