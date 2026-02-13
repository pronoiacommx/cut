from __future__ import annotations

import os
import json
import subprocess
import uuid
import hashlib
import secrets
import hmac
import pdfkit
import string  # <--- Esto faltaba para generar la contraseña
import unicodedata
from passlib.hash import bcrypt

from datetime import datetime, timedelta 
from pathlib import Path
from typing import Dict, Optional, Literal

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Query, Body, Request,Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from docxtpl import DocxTemplate
# CORREOS
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

from pydantic import BaseModel
from dotenv import load_dotenv
import pymysql
import uuid
from typing import Any
path_wkhtmltopdf = '/usr/local/bin/wkhtmltopdf'
def hash_password(password: str) -> str:
    iters = 100000
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iters, dklen=32)
    return f"pbkdf2${iters}${salt.hex()}${dk.hex()}"
    # Si detecta que estás en el servidor usa la real, si no, usa localhost
    

# Cargar las variables al iniciar la app
load_dotenv()
# Detectar si estamos en producción
IS_PRD = os.getenv("PRODUCTION", "false").lower() == "true"

# Sufijo para las variables (LOCAL o PRD)
sfx = "_PRD" if IS_PRD else "_LOCAL"
ROOT_DIR = Path(__file__).resolve().parent
class Config:
    # --- BASE DE DATOS ---
    DB_HOST = os.getenv(f"MYSQL_HOST{sfx}")
    DB_PORT = int(os.getenv(f"MYSQL_PORT{sfx}", 3306))
    DB_NAME = os.getenv(f"MYSQL_DB{sfx}")
    DB_USER = os.getenv(f"MYSQL_USER{sfx}")
    DB_PASS = os.getenv(f"MYSQL_PASS{sfx}")

    # --- SMTP ---
    SMTP_ENABLED = 1
    SMTP_HOST = os.getenv(f"SMTP_HOST{sfx}")
    SMTP_PORT = int(os.getenv(f"SMTP_PORT{sfx}", 587))
    SMTP_USER = os.getenv(f"SMTP_USER{sfx}")
    SMTP_PASS = os.getenv(f"SMTP_PASS{sfx}")
    SMTP_FROM = os.getenv(f"SMTP_FROM{sfx}")
    
    # --- URLS ---
    BASE_URL = os.getenv(f"URL{sfx}") if IS_PRD else os.getenv(f"URL{sfx}")
    BASE_API_URL = os.getenv(f"URL_API{sfx}") if IS_PRD else os.getenv(f"URL_API{sfx}")

print(f"⚠️ BASE_URL: {Config.BASE_URL}")
print(f"⚠️ BASE_API_URL: {Config.BASE_API_URL}")
print(f"⚠️ SMTP_HOST: {Config.SMTP_HOST}")


PBKDF2_ITERS = 200000#int(os.getenv("PBKDF2_ITERS", "200000"))

BASE_DIR = Path(__file__).resolve().parent
TEMPLATE_DIR = BASE_DIR / "template"
STORAGE_DIR = BASE_DIR / "storage"
OUT_DIR = STORAGE_DIR / "out"
UPLOADS_DIR = STORAGE_DIR / "uploads"

TOKENS_FILE = BASE_DIR / "template_tokens.json"
TEMPLATE_FILE = TEMPLATE_DIR / "contrato_template.docx"

# Si después quieres quitar el prefijo cut_, cambia esto a "" y renombra tablas
TABLE_PREFIX = ""

SOFFICE_BIN = os.getenv(
    "SOFFICE_BIN",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice"
)


def db():
    return pymysql.connect(
        host=Config.DB_HOST, port=Config.DB_PORT,
        user=Config.DB_USER, password=Config.DB_PASS,
        database=Config.DB_NAME, charset="utf8mb4",
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
# FastAPI app
# =========================
app = FastAPI(title="CUT Contratos API", version="1.0.0")
# Configuración de CORS
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
# Esto mapea la URL "/storage" a tu carpeta física STORAGE_DIR
app.mount("/storage", StaticFiles(directory=str(STORAGE_DIR)), name="storage")

# =========================================================
# CONTRATOS / EXPEDIENTES
# =========================================================
def step_to_percent(step: int) -> int:
    # s: 1..3
    try:
        s = int(step or 1)
    except:
        s = 1
    
    # Aseguramos que el paso esté entre 1 y 3
    s = max(1, min(5, s))
    
    # 1 => 33, 2 => 67, 3 => 100
    # Usamos round para que los decimales no se vean mal
    return int(round((s / 5) * 100))

def aspirante_nombre_completo(a: dict) -> str:
    parts = [
        (a.get("nombre") or "").strip(),
        (a.get("apellido_paterno") or "").strip(),
        (a.get("apellido_materno") or "").strip(),
    ]
    return " ".join([p for p in parts if p]).strip()

def draft_locked(stage: int) -> bool:
    # 5+ = aprobado RH / firmado / completado
    try:
        return int(stage or 1) >= 5
    except:
        return False

def ensure_not_locked(stage: int):
    if draft_locked(stage):
        raise HTTPException(status_code=403, detail="Expediente en revisión/aprobado. Ya no puedes modificarlo.")

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

# =========================================================
# Archivos generacion
# =========================================================
# @app.put("/api/public/contract/complete-step")
# async def complete_step(guid: str, step: int, status: str = "EN_PROCESO"):
#     conn = db()
#     try:
#         with conn.cursor() as cur:
#             # Actualizamos el paso actual y el estatus en la tabla de borradores
#             cur.execute("""
#                 UPDATE contrato_borradores 
#                 SET status = %s, 
#                     payload = JSON_SET(payload, '$.__meta.step', %s),
#                     updated_at = CURRENT_TIMESTAMP,
#                     current_step = 4 
#                 WHERE guid = %s
#             """, (status, step, guid))
            
#             # Si el estatus es COMPLETADO, también actualizamos la tabla de aspirantes
#             if status == "COMPLETADO":
#                 cur.execute("""
#                     UPDATE aspirantes 
#                     SET estatus = 'POR_VALIDAR', updated_at = CURRENT_TIMESTAMP 
#                     WHERE guid = %s
#                 """, (guid,))
                
#         return {"ok": True, "message": "Estado de RH actualizado"}
#     finally:
#         conn.close()


def limpiar_texto(texto):
    if not texto:
        return ""
    # Normaliza el texto a NFD (descompone caracteres con acento en letra + acento)
    # Luego filtra solo los caracteres que no sean marcas de acentuación
    return "".join(
        c for c in unicodedata.normalize('NFD', texto)
        if unicodedata.category(c) != 'Mn'
    )
@app.post("/api/public/contract/upload-attachment")
async def upload_attachment(
    guid: str = Form(...),
    field_name: str = Form(...),
    file: UploadFile = File(...)
):
    ensure_dirs()
    
    # 1. Buscar el borrador para saber a qué carpeta enviar
    conn = db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, payload FROM contrato_borradores WHERE guid = %s", (guid,))
            borrador = cur.fetchone()
            if not borrador:
                raise HTTPException(status_code=404, detail="GUID no encontrado")
            
            # Usamos el RFC del payload para la carpeta o el GUID
            import json
            payload = json.loads(borrador["payload"])
            rfc = payload.get("profesionista_rfc", "SIN_RFC")
            nombre = payload.get("profesionista_nombre", "SIN_NOMBRE").replace(" ", "_")
            
            nombre_limpio = limpiar_texto(nombre).replace(" ", "_").upper()
            folder_name = f"{nombre_limpio}_{rfc}"
            
            # 2. Guardar archivo físicamente
            uploads_dir = UPLOADS_DIR / folder_name
            uploads_dir.mkdir(parents=True, exist_ok=True)            
            file_extension = Path(file.filename).suffix

            # Normalizamos el nombre (ej: file_ine_frente -> INE_FRENTE.pdf)
            clean_name = field_name.replace("file_", "").upper()
            file_path = uploads_dir / f"{clean_name}{file_extension}"
            
            with file_path.open("wb") as f:
                f.write(await file.read())

            # Esto convertirá "/Applications/XAMPP/.../storage/uploads/Héctor/INE.jpg" 
            # en "storage/uploads/Héctor/INE.jpg"
            path_para_bd = str(file_path.relative_to(BASE_DIR))

            # 3. Guardar en la tabla contrato_adjuntos
            # Nota: Si el contrato aún no se genera, podrías guardarlo 
            # asociado al GUID del borrador temporalmente.
            cur.execute(f"""
                INSERT INTO {TABLE_PREFIX}contrato_adjuntos 
                (borrador_guid, nombre, local_path) 
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE local_path=VALUES(local_path)
            """, (guid, field_name, str(path_para_bd)))
            
        return {"ok": True, "path": str(path_para_bd)}
    finally:
        conn.close()
@app.post("/api/contracts/generate")
async def generate_contract(
    guid: Optional[str] = Form(None),
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
        # ---- Marcar borrador como COMPLETADO si viene GUID ----
    if guid:
        try:
            conn2 = db()
            with conn2.cursor() as cur2:
                cur2.execute("""
                    UPDATE contrato_borradores
                    SET status='COMPLETADO', updated_at=CURRENT_TIMESTAMP
                    WHERE guid=%s
                """, (guid.strip(),))

                cur2.execute("""
                    UPDATE aspirantes
                    SET estatus='COMPLETADO', updated_at=CURRENT_TIMESTAMP
                    WHERE guid=%s
                """, (guid.strip(),))
        finally:
            try: conn2.close()
            except: pass

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

#PUBLIC_CONTRACT_URL_BASE = "http://localhost:8000/ui/public/contratos.html"# os.getenv("PUBLIC_CONTRACT_URL_BASE", "http://localhost:8000/ui/public/contratos.html")

def full_name(nombre: str, ap: str, am: str) -> str:
    return " ".join([nombre.strip(), ap.strip(), am.strip()]).strip()

def json_dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False)

def json_loads(s: str):
    # SANITIZACIÓN: Reemplazar comillas curvas por rectas
    s_clean = s.replace('“', '"').replace('”', '"').replace('‘', "'").replace('’', "'")
    return json.loads(s_clean) if s_clean else None



class AspiranteCreate(BaseModel):
    nombre : str
    apellido_paterno: str
    apellido_materno: str
    email: str

class DraftSave(BaseModel):
    payload: dic

def full_name(nombre: str, ap: str, am: Optional[str]) -> str:
    parts = [nombre.strip(), ap.strip()]
    if am and am.strip():
        parts.append(am.strip())
    return " ".join(parts)

 
# =========================================================
# RH: LISTAR aspirantes (GET)
# =========================================================
from fastapi import Body  # asegúrate de tener esto importado
@app.get("/api/rh/aspirantes")
#def rh_list_aspirantes(page: int = 1, page_size: int = 20, ok=Depends(require_rh)):
def rh_list_aspirantes(page: int = 1, page_size: int = 20, search: str = ""):
    page = max(1, int(page))
    page_size = min(100, max(1, int(page_size)))
    offset = (page - 1) * page_size
    # 1. Definir base de la cláusula WHERE
    where_clause = "WHERE a.is_active = 1"
    query_params = []

    # 2. Agregar filtro de búsqueda si existe
    if search:
        where_clause += """ AND (
            a.nombre LIKE %s OR 
            a.apellido_paterno LIKE %s OR 
            a.apellido_materno LIKE %s OR 
            a.email LIKE %s
        )"""
        term = f"%{search}%"
        query_params.extend([term, term, term, term])
    try:
        conn = db()
        with conn.cursor() as cur:
            # --- CONTEO TOTAL ---
            # IMPORTANTE: Usar f-string aquí para inyectar la cláusula
            count_sql = f"SELECT COUNT(*) AS total FROM aspirantes a {where_clause}"
            cur.execute(count_sql, query_params)
            total = int(cur.fetchone()["total"])

            # 3. Consulta principal con paginación
            sql = f"""
                SELECT
                    a.aspirante_id,
                    a.guid,
                    a.nombre, a.apellido_paterno, a.apellido_materno,
                    a.email,
                    a.created_at,
                    a.invite_sent_count,
                    a.invite_sent_at,
                    a.updated_at,
                    b.current_step,
                    b.last_saved_at,
                    b.is_active AS draft_active,
                    -- Aplicamos COLLATE para evitar el error 1267
                    (SELECT ca.local_path FROM contrato_adjuntos ca 
                    WHERE ca.borrador_guid COLLATE utf8mb4_general_ci = a.guid COLLATE utf8mb4_general_ci 
                    AND ca.nombre = 'file_ine_frente' LIMIT 1) as path_ine_frente,
                    (SELECT ca.local_path FROM contrato_adjuntos ca 
                    WHERE ca.borrador_guid COLLATE utf8mb4_general_ci = a.guid COLLATE utf8mb4_general_ci 
                    AND ca.nombre = 'file_ine_vuelta' LIMIT 1) as path_ine_vuelta,
                    (SELECT ca.local_path FROM contrato_adjuntos ca 
                    WHERE ca.borrador_guid COLLATE utf8mb4_general_ci = a.guid COLLATE utf8mb4_general_ci 
                    AND ca.nombre = 'file_curp' LIMIT 1) as path_curp,
                    (SELECT ca.local_path FROM contrato_adjuntos ca 
                    WHERE ca.borrador_guid COLLATE utf8mb4_general_ci = a.guid COLLATE utf8mb4_general_ci 
                    AND ca.nombre = 'file_constancia_fiscal' LIMIT 1) as path_constancia_fiscal,
                    -- Corregido el typo 'aspguidirante_id' a 'guid'
                    (SELECT ca.local_path FROM contrato_adjuntos ca 
                    WHERE ca.borrador_guid COLLATE utf8mb4_general_ci = a.guid COLLATE utf8mb4_general_ci 
                    AND ca.nombre = 'file_comprobante' LIMIT 1) as path_comprobante,
                    COALESCE(b.etapa_flujo, 1) as etapa_flujo, 
                    COALESCE(b.status, 'PENDIENTE') as borrador_status,
                    (SELECT JSON_OBJECT(
                    'ine1', COALESCE(MAX(CASE WHEN nombre = 'file_ine_frente' THEN 
                                CASE 
                                    WHEN status = 2 THEN 'validado' 
                                    WHEN status = 3 THEN 'rechazado' 
                                    WHEN status = 1 THEN 'cargado' 
                                    ELSE 'vacio' 
                                END 
                            END), 'vacio'),
                    'ine2', COALESCE(MAX(CASE WHEN nombre = 'file_ine_vuelta' THEN 
                                CASE 
                                    WHEN status = 2 THEN 'validado' 
                                    WHEN status = 3 THEN 'rechazado' 
                                    WHEN status = 1 THEN 'cargado' 
                                    ELSE 'vacio' 
                                END 
                            END), 'vacio'),
                    'curp', COALESCE(MAX(CASE WHEN nombre = 'file_curp' THEN 
                                CASE 
                                    WHEN status = 2 THEN 'validado' 
                                    WHEN status = 3 THEN 'rechazado' 
                                    WHEN status = 1 THEN 'cargado' 
                                    ELSE 'vacio' 
                                END 
                            END), 'vacio'),
                    'rfc',  COALESCE(MAX(CASE WHEN nombre = 'file_constancia_fiscal' THEN 
                                CASE 
                                    WHEN status = 2 THEN 'validado' 
                                    WHEN status = 3 THEN 'rechazado' 
                                    WHEN status = 1 THEN 'cargado' 
                                    ELSE 'vacio' 
                                END 
                            END), 'vacio'),
                    'dom',  COALESCE(MAX(CASE WHEN nombre = 'file_comprobante' THEN 
                                CASE 
                                    WHEN status = 2 THEN 'validado' 
                                    WHEN status = 3 THEN 'rechazado' 
                                    WHEN status = 1 THEN 'cargado' 
                                    ELSE 'vacio' 
                                END 
                            END), 'vacio')
                ) FROM contrato_adjuntos WHERE TRIM(borrador_guid) = TRIM(a.guid)) as docs_status
                FROM aspirantes a
                LEFT JOIN contrato_borradores b ON b.aspirante_id = a.aspirante_id
                {where_clause}
                ORDER BY a.created_at DESC
                LIMIT %s OFFSET %s
            """
            # Añadimos los parámetros de paginación al final de la lista de parámetros de búsqueda
            final_params = query_params + [page_size, offset]
            cur.execute(sql, final_params)

            rows = cur.fetchall()

            items = []
            for r in rows:
                step = int(r.get("current_step") or 1)
                percent = step_to_percent(step)
                name = aspirante_nombre_completo(r)
                items.append({
                    "aspirante_id": r["aspirante_id"],
                    "guid": r["guid"],
                    "nombre_completo": name,
                    "email": r["email"],
                    "current_step": step,
                    "invite_sent_count": r["invite_sent_count"],
                    "invite_sent_at": r["invite_sent_at"],
                    "percent_complete": percent,
                    "last_saved_at": r["last_saved_at"].isoformat() if r.get("last_saved_at") else None,
                    "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
                    "is_active": 1,
                    "link_contratos": f"/cut/contratos/public/contratos.html?guid={r['guid']}",
                    "path_ine_frente":r["path_ine_frente"],
                    "path_ine_vuelta":r["path_ine_vuelta"],
                    "path_comprobante":r["path_comprobante"],
                    "path_curp":r["path_curp"],
                    "path_constancia_fiscal":r["path_constancia_fiscal"],
                    "etapa_flujo":r["etapa_flujo"],
                    "borrador_status":r["borrador_status"],
                    "docs_status":r["docs_status"]
                })
            return {
                "ok": True,
                "page": page,
                "page_size": page_size,
                "total": total,
                "pages": (total + page_size - 1) // page_size,
                "items": items
            }
    finally:
        try: conn.close()
        except: pass

# =========================================================
# RH: CREAR aspirante (POST)
# =========================================================
from fastapi import Body, HTTPException
from fastapi.responses import JSONResponse
from pymysql.err import IntegrityError
import uuid

@app.post("/api/rh/aspirantes")
def rh_create_aspirantes(body: AspiranteCreate = Body(...)):
    guid = str(uuid.uuid4())
    nombre_completo = full_name(body.nombre, body.apellido_paterno, body.apellido_materno)
    email_clean = body.email.strip().lower()

    conn = db()
    try:
        with conn.cursor() as cur:
            # --- BLOQUE DE INSERCIÓN ---
            try:
                # 1. Inserta aspirante
                cur.execute("""
                    INSERT INTO aspirantes
                    (guid, nombre, apellido_paterno, apellido_materno, nombre_completo, email, estatus)
                    VALUES (%s,%s,%s,%s,%s,%s,'INVITADO')
                """, (
                    guid, body.nombre.strip(), body.apellido_paterno.strip(),
                    body.apellido_materno.strip(), nombre_completo, email_clean
                ))
                aspirante_id = cur.lastrowid

                # 2. Crea borrador
                cur.execute("""
                    INSERT INTO contrato_borradores (aspirante_id, guid, payload, current_step, status, last_saved_at)
                    VALUES (%s,%s,%s,1,'DRAFT',NULL)
                """, (aspirante_id, guid, None))
                
                conn.commit()
            
            except IntegrityError as e:
                conn.rollback() # Limpiamos cualquier rastro del error en la conexión
                if e.args[0] == 1062:
                    # Devolvemos un 400 limpio para el frontend
                    return JSONResponse(
                        status_code=400,
                        content={"ok": False, "detail": f"El correo '{email_clean}' ya está registrado."}
                    )
                raise e # Si es otro error de integridad (ej. un null), que truene normal

        # --- LÓGICA DE ENVÍO DE CORREO (Fuera del try de DB anterior) ---
        #public_url = f"{BASE_DIR}/public/contratos.html?guid={guid}"
        
        url_bienvenida = f"{Config.BASE_URL}/public/contratos.html?guid={guid}"
        try:
            enviar_correo_invitacion(email_clean, nombre_completo, url_bienvenida)
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE aspirantes
                    SET invite_sent_at = NOW(),
                        invite_sent_count = invite_sent_count + 1,
                        last_invite_error = NULL
                    WHERE aspirante_id = %s
                """, (aspirante_id,))
                conn.commit()
        except Exception as e:
            print(f"⚠️ Error de email: {e}")
            with conn.cursor() as cur:
                cur.execute("UPDATE aspirantes SET last_invite_error = %s WHERE aspirante_id = %s", (str(e), aspirante_id))
                conn.commit()

        return {
            "ok": True, 
            "guid": guid,
            "aspirante_id": aspirante_id,
            "nombre_completo": nombre_completo,
            "email": email_clean,
            "public_url": public_url
        }

    except Exception as e:
        # Captura errores generales de conexión o lógica
        print(f"❌ Error general: {e}")
        return JSONResponse(status_code=500, content={"detail": str(e)})
        
    finally:
        try: conn.close()
        except: pass
# =========================================================
# RH: Reenviar correo
# =========================================================
# @app.get("/api/rh/smtp/status")
# def smtp_status():
#     return {
#         "SMTP_ENABLED": SMTP_ENABLED,
#         "SMTP_HOST": SMTP_HOST,
#         "SMTP_PORT": SMTP_PORT,
#         "SMTP_USER": SMTP_USER,
#         "SMTP_FROM": SMTP_FROM,
#         "TLS": True
#     }

# =========================================================
# RH: Reenviar correo
# =========================================================
@app.post("/api/rh/aspirantes/{aspirante_id}/resend")
def rh_resend_invite(aspirante_id: int):
    try:
        conn = db()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT aspirante_id, guid, nombre, apellido_paterno, apellido_materno, email
                FROM aspirantes
                WHERE aspirante_id = %s
                LIMIT 1
            """, (aspirante_id,))
            a = cur.fetchone()
            if not a:
                raise HTTPException(status_code=404, detail="Aspirante no encontrado.")

            nombre_completo = f"{a['nombre']} {a['apellido_paterno']} {(a.get('apellido_materno') or '')}".strip()
            #link = make_public_contract_url(a["guid"])
            guid = a["guid"]
            # Cuando mandes el correo:
            url_bienvenida = f"{Config.BASE_URL}/public/contratos.html?guid={guid}"
            try:
                enviar_correo_invitacion(a["email"], nombre_completo, url_bienvenida)
                cur.execute("""
                    UPDATE aspirantes
                    SET invite_sent_at = NOW(),
                        invite_sent_count = invite_sent_count + 1,
                        last_invite_error = NULL
                    WHERE aspirante_id = %s
                """, (aspirante_id,))
                return {"ok": True, "email_ok": True, "link": url_bienvenida}
            except Exception as e:
                cur.execute("""
                    UPDATE aspirantes
                    SET last_invite_error = %s
                    WHERE aspirante_id = %s
                """, (str(e), aspirante_id))
                raise HTTPException(status_code=500, detail=f"No se pudo reenviar: {e}")
    finally:
        try:
            conn.close()
        except:
            pass

# =========================================================
# Obtener datos para mostrar en la carga de informacion del aspirante
# =========================================================
@app.get("/api/public/contract")
def public_get_contract(guid: str = Query(...)):
    guid = guid.strip()

    try:
        conn = db()
        with conn.cursor() as cur:
            # 1. Obtener datos del borrador/aspirante
            cur.execute("SELECT * FROM contrato_borradores WHERE guid = %s", (guid,))
            borrador = cur.fetchone()
            if not borrador: raise HTTPException(status_code=404)

            # 2. Obtener ADJUNTOS ya subidos para este GUID
            cur.execute("""
                SELECT nombre, local_path 
                FROM contrato_adjuntos 
                WHERE borrador_guid = %s
            """, (guid,))
            adjuntos = cur.fetchall() # Esto devuelve una lista de diccionarios
            cur.execute("""
                SELECT aspirante_id, guid, nombre_completo, email, estatus
                FROM aspirantes
                WHERE guid=%s
                LIMIT 1
            """, (guid,))
            w = cur.fetchone()
            if not w:
                raise HTTPException(status_code=404, detail="GUID no encontrado.")

            cur.execute("""
                SELECT payload, current_step, status, last_saved_at
                FROM contrato_borradores
                WHERE guid=%s
                LIMIT 1
            """, (guid,))
            d = cur.fetchone()

            draft = None
            if d:
                draft = {
                    "payload": json_loads(d.get("payload")),
                    "current_step": d.get("current_step"),
                    "status": d.get("status"),
                    "last_saved_at": d.get("last_saved_at").isoformat() if d.get("last_saved_at") else None
                }

            return {
                "ok": True,
                "aspirante": {
                    "guid": w["guid"],
                    "nombre_completo": w["nombre_completo"],
                    "email": w["email"],
                    "estatus": w["estatus"],
                    "current_step": d["current_step"]
                },
                "adjuntos": adjuntos, # Enviamos la lista al frontend
                "draft": draft
            }
    finally:
        try: conn.close()
        except: pass


class DraftSave(BaseModel):
    payload: dict

# =========================================================
# guardar de informacion del aspirante
# =========================================================

@app.put("/api/public/contract")
def public_save_contract(guid: str = Query(...), body: DraftSave = Body(...)):
    guid = guid.strip()    
    # Preparamos los datos
    payload = body.payload or {}
    try:
        # Extraemos el paso de forma segura
        step = int(payload.get("__meta", {}).get("step", 1))
        step = max(1, min(4, step)) # Limitamos entre 1 y 4
    except:
        step = 1

    conn = None
    try:
        conn = db()
        with conn.cursor() as cur:
            # 1️⃣ PRIMERO: Validamos que el GUID exista y obtenemos el ID
            cur.execute("SELECT aspirante_id, email, nombre_completo FROM aspirantes WHERE guid=%s LIMIT 1", (guid,))
            aspirante = cur.fetchone()
            
            print("1️⃣ PRIMERO: Validamos que el GUID exista y obtenemos el ID")
            if not aspirante:
                raise HTTPException(status_code=404, detail="Enlace inválido o expirado.")
            
            aspirante_id = aspirante["aspirante_id"]
            email_aspirante = aspirante["email"]
            nombre_aspirante = aspirante["nombre_completo"]

            # 2️⃣ SEGUNDO: Verificamos si RH ya bloqueó el expediente
            # (Buscamos si ya existe un borrador previo para este ID)
            cur.execute("""
                SELECT current_step 
                FROM contrato_borradores 
                WHERE aspirante_id = %s
            """, (aspirante_id,))
            borrador_existente = cur.fetchone()

            print("2️⃣ SEGUNDO: Verificamos si RH ya bloqueó el expediente",email_aspirante)
            # Si ya existe y está en paso 4 o más, bloqueamos la edición
            if borrador_existente and borrador_existente["current_step"] >= 4:
                raise HTTPException(
                    status_code=403,
                    detail="Tu expediente ya está en revisión final. No puedes editarlo."
                )
            # 3️⃣ Lógica de Etapa: Si el frontend manda step 4, el docente terminó su carga.
            # Esto lo mueve automáticamente a la Etapa 4 (Revisión de RH)
            nueva_etapa = 4 if step == 4 else step
            nuevo_estatus = 'POR_VALIDAR' if step == 4 else 'EN_PROCESO'

            # 4️⃣ Guardamos (Upsert)
            # Nota: json.dumps convierte el diccionario a string para la BD
            payload_str = json.dumps(payload)            
            cur.execute("""
                INSERT INTO contrato_borradores
                  (aspirante_id, guid, payload, current_step, etapa_flujo, status, last_saved_at)
                VALUES
                  (%s, %s, %s, %s, %s, %s, NOW())
                ON DUPLICATE KEY UPDATE
                  payload=VALUES(payload),
                  current_step=VALUES(current_step),
                  status = VALUES(status),
                  last_saved_at=NOW(),
                  updated_at=NOW(),
                  etapa_flujo=VALUES(etapa_flujo)
            """, (aspirante_id, guid, payload_str, step, nueva_etapa, nuevo_estatus))
            
            print("3️⃣ TERCERO: Guardamos (Upsert)")
            # # # 4️⃣ CUARTO: Actualizamos estatus del aspirante (si no estaba completado)
            # cur.execute("""
            #     UPDATE aspirantes
            #     SET estatus = %s, updated_at = NOW()
            #     WHERE id = %s
            # """, (nuevo_estatus, aspirante_id))

            print("4️⃣ CUARTO: Actualizamos estatus del aspirante (si no estaba completado)",str(step))
            if step == 4:
                enviar_correo_validacion_pendiente(email_aspirante, nombre_aspirante)
            # ✅ IMPORTANTE: Guardar cambios
            conn.commit()

        return {
                    "ok": True, 
                    "step_saved": step, 
                    "etapa_actual": nueva_etapa,
                    "status": nuevo_estatus
                }

    except HTTPException as he:
        # Re-lanzamos errores HTTP controlados (404, 403)
        raise he
    except Exception as e:
        print(f"❌ Error guardando contrato: {e}")
        raise HTTPException(status_code=500, detail="Error interno al guardar")
    finally:
        if conn:
            try: conn.close()
            except: pass

@app.get("/api/aspirantes/{guid}")
def get_aspirante(guid: str):
    guid = (guid or "").strip()
    if not guid:
        raise HTTPException(status_code=400, detail="guid requerido")

    try:
        conn = db()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, guid, nombre, apellido_paterno, apellido_materno, email
                FROM aspirantes
                WHERE guid=%s
                LIMIT 1
            """, (guid,))
            row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="Aspirante no encontrado")

            full_name = " ".join([row.get("nombre",""), row.get("apellido_paterno",""), row.get("apellido_materno","")]).strip()

            return {
                "ok": True,
                "aspirante_id": row["id"],
                "guid": row["guid"],
                "nombre_completo": full_name,
                "email": row["email"],
            }
    finally:
        try: conn.close()
        except: pass


# =========================================================
# RH: APROBAR Y ENVIAR A FIRMA
# =========================================================
@app.post("/api/rh/aspirantes/{aspirante_id}/approve")
#def rh_approve_and_send_sign(aspirante_id: int, ok=Depends(require_rh)):
def rh_approve_and_send_sign(aspirante_id: int):
    
    print("rh_approve_and_send_sign.........")
    try:
        conn = db()
        with conn.cursor() as cur:
            # aspirante
            cur.execute("SELECT * FROM aspirantes WHERE aspirante_id=%s AND is_active=1 LIMIT 1", (aspirante_id,))
            a = cur.fetchone()
            if not a:
                raise HTTPException(404, "Aspirante no encontrado")

            # borrador
            cur.execute("""
                SELECT aspirante_id, payload, current_step, last_saved_at, is_active
                FROM contrato_borradores
                WHERE aspirante_id=%s AND is_active=1
                LIMIT 1
            """, (aspirante_id,))
            d = cur.fetchone()
            if not d:
                raise HTTPException(400, "No hay borrador/avance para este aspirante.")

            step = int(d.get("current_step") or 1)
            # Si ya aprobado o más, no re-apruebes (puedes permitir reenviar firma si quieres)
            if step >= 5:
                raise HTTPException(409, "Este expediente ya está aprobado/firma en proceso.")

            # Validación mínima (según tu payload)
            payload = {}
            try:
                payload = json.loads(d.get("payload") or "{}")
            except:
                payload = {}

            # ejemplo de campos obligatorios
            required_fields = [
                "profesionista_rfc", "profesionista_curp", "profesionista_telefono",
                "profesionista_domicilio_fiscal", "servicio_periodo", "servicio_carrera", "servicio_materia"
            ]
            missing = [f for f in required_fields if not str(payload.get(f, "")).strip()]
            if missing:
                raise HTTPException(400, f"Faltan campos obligatorios en el borrador: {', '.join(missing)}")

            # 1) bloquear: paso 5 = APROBADO RH
            cur.execute("""
                UPDATE contrato_borradores
                SET current_step=5, etapa_flujo=5, last_saved_at=CURRENT_TIMESTAMP
                WHERE aspirante_id=%s
            """, (aspirante_id,))

            # 2) crear token firma
            raw = secrets.token_hex(32)  # 64 chars
            token = raw

            cur.execute("""
                INSERT INTO firma_solicitudes (aspirante_id, token, status)
                VALUES (%s, %s, 'PENDING')
            """, (aspirante_id, token))

            name = aspirante_nombre_completo(a)
            sign_url = f"{Config.BASE_API_URL}/ui/public/firma_aspirante.html?token={token}"

            enviar_correo_firma(a["email"], name, sign_url)

            return {
                "ok": True, 
                "message": "Aspirante aprobado y correo de firma enviado",
                "aspirante": full_name,
                "email": a["email"]
            }
    finally:
        conn.close()
# Endpoint en FastAPI / Flask
@app.post("/api/rh/documento/aprobarRechazar")
async def aprobarRechazarDocumento(data: dict):
    guid = data.get('guid')
    campo = data.get('campo')
    estado = data.get('estado') # 'validado' o 'rechazado'
    fileName = data.get('fileName')
    
    # 2 = Validado (Verde), 3 = Rechazado (Rojo)
    status_num = 2 if estado == 'validado' else 3
    
    conn = None
    try:
        conn = db()
        with conn.cursor() as cursor:
            # 1. Actualizar el estatus del documento
            cursor.execute("""
                UPDATE contrato_adjuntos 
                SET status = %s 
                WHERE borrador_guid = %s AND nombre = %s
            """, (status_num, guid, fileName))
            
            # 2. Opcional: Si es rechazado, bajar al aspirante de etapa para que corrija
            if status_num == 3:
                cursor.execute("UPDATE aspirantes SET etapa_flujo = 3 WHERE guid = %s", (guid,))
                # Aquí llamaríamos a la función SMTP enviando el aviso de rechazo
                #enviar_correo_smtp(aspirante_email, "Rechazo de Documentos")
                
            conn.commit()
        return {"ok": True}
        
    finally:
        conn.close()# =========================================================
# PROFESOR: FIRMA
# =========================================================
@app.get("/api/public/sign")
def public_sign_info(token: str):
    try:
        conn = db()
        with conn.cursor() as cur:
            # Traemos datos del aspirante + el borrador del contrato
            cur.execute("""
                SELECT f.status, a.nombre, a.apellido_paterno, a.apellido_materno, a.email, b.payload
                FROM firma_solicitudes f
                JOIN aspirantes a ON a.aspirante_id = f.aspirante_id
                LEFT JOIN contrato_borradores b ON a.aspirante_id = b.aspirante_id
                WHERE f.token=%s AND (b.is_active=1 OR b.is_active IS NULL)
                LIMIT 1
            """, (token,))
            row = cur.fetchone()
            
            if not row:
                raise HTTPException(404, "Enlace de firma no válido o expirado")

            name = f"{row['nombre']} {row['apellido_paterno']} {row['apellido_materno']}".strip()
            
            # Decodificar el contrato para mostrarlo en el frontend
            payload = {}
            try:
                payload = json.loads(row["payload"] or "{}") if row["payload"] else {}
            except:
                payload = {}

            return {
                "ok": True,
                "status": row["status"],
                "aspirante": {"name": name, "email": row["email"]},
                "contrato_data": payload, # Datos para llenar las cláusulas en el HTML
                "is_signed": row["status"] == "SIGNED"
            }
    finally:
        conn.close()
# =========================================================
# ENVIA FIRMA, ACTUALIZA TABLAS CREA PROFESIONISTA Y MANDA CORREO BIENVENIDA
# =========================================================
class SignSubmit(BaseModel):
    signature_png: str  # base64 (sin prefix)

@app.post("/api/public/sign/submit")
def public_sign_submit(token: str, body: SignSubmit, request: Request):
    sig = (body.signature_png or "").strip()
    if not sig:
        raise HTTPException(400, "La firma es obligatoria")

    conn = db()
    try:
        with conn.cursor() as cur:
            # 1. Validar Token y obtener ID
            cur.execute("""
                SELECT f.aspirante_id, f.status, a.nombre, a.apellido_paterno, a.apellido_materno, a.email
                FROM firma_solicitudes f
                JOIN aspirantes a ON a.aspirante_id = f.aspirante_id
                WHERE f.token=%s LIMIT 1
            """, (token,))
            row = cur.fetchone()

            if not row: raise HTTPException(404, "Token inválido")
            if row["status"] == "SIGNED": return {"ok": True, "already": True}

            # 2. Datos de auditoría legal
            ip = request.client.host if request.client else "0.0.0.0"
            ua = request.headers.get("user-agent", "")[:255]
            aspirante_id = row["aspirante_id"]
            name = f"{row['nombre']} {row['apellido_paterno']} {row['apellido_materno']}".strip()

            # 3. Procesar Payload del borrador
            cur.execute("SELECT payload FROM contrato_borradores WHERE aspirante_id=%s AND is_active=1", (aspirante_id,))
            d = cur.fetchone()
            payload = json.loads(d["payload"] or "{}") if d else {}
            # Extraemos los datos del payload (Asegúrate que estos nombres coincidan con tus inputs del HTML)
            v_curp = payload.get("profesionista_curp", "").strip().upper()
            v_rfc  = payload.get("profesionista_rfc", "").strip().upper()
            v_tel  = payload.get("profesionista_telefono", "").strip()
            v_gen  = payload.get("profesionista_genero", "M") # Valor por defecto
            v_guid  = payload.get("guid", "") 
            # 4. Generar num_empleado Consecutivo (CUT-PROF-001)
            cur.execute("SELECT COUNT(*) as total FROM empleados WHERE num_empleado LIKE 'CUT-PROF-%'")
            count_res = cur.fetchone()
            consecutivo = (count_res['total'] or 0) + 1
            nuevo_num_empleado = f"CUT-PROF-{str(consecutivo).zfill(3)}"
            # Generar clave temporal de 8 caracteres
            temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
            hashed_pw = bcrypt.hash(temp_password)

            # --- INICIO DE TRANSACCIÓN ATÓMICA ---
            # A) Registrar la firma
            cur.execute("""
                UPDATE firma_solicitudes
                SET status='SIGNED', signed_at=CURRENT_TIMESTAMP,
                    ip_address=%s, user_agent=%s, signature_png=%s
                WHERE token=%s
            """, (ip, ua, sig, token))
            apellidos = f"{row['apellido_paterno']} {row['apellido_materno']}".strip()
            # B) Promover a tabla oficial 'profesionistas'
            # cur.execute("""
            #     INSERT INTO empleados 
            #     (num_empleado, nombre, apellidos, genero, curp, rfc, 
            #      telefono, departamento, puesto, fecha_ingreso, created_at)
            #     VALUES (%s, %s, %s, %s, %s, %s, %s, 'ACADEMICO', 'PROFESOR', CURDATE(), NOW())
            # """, (
            #     nuevo_num_empleado, 
            #     row['nombre'], 
            #     apellidos, 
            #     v_gen, 
            #     v_curp, 
            #     v_rfc, 
            #     v_tel
            # ))
            # # --- CAPTURAMOS EL ID DEL EMPLEADO RECIÉN INSERTADO ---
            # nuevo_empleado_id = cur.lastrowid

            # cur.execute("""
            #     SELECT id, nombre_rol, slug
            #     FROM roles f
            #     WHERE nombre_rol="Profesor" LIMIT 1
            # """)
            # rol = cur.fetchone()

            # # C) Insertar en USUARIOS (con force_change=1 para que la cambie al entrar)
            # cur.execute("""
            #     INSERT INTO usuarios (email, password, rol_id, force_change, perfil_tipo, perfil_id, status)
            #     VALUES (%s, %s, %s, 1, "EMPLEADO", %s, 1)
            # """, (
            #     row['email'],  # Corresponde al 1er %s
            #     hashed_pw,     # Corresponde al 2do %s
            #     rol['id'],      # Corresponde al 3er %s
            #     nuevo_empleado_id
            # ))

            # D) Cerrar borrador (Paso 7: Finalizado)
            cur.execute("UPDATE contrato_borradores SET current_step=6, etapa_flujo=6 WHERE aspirante_id=%s", (aspirante_id,))
            
            conn.commit()
            # --- FIN DE TRANSACCIÓN ---
            # enviar_correo_bienvenida(
            #     to_email=row['email'],
            #     nombre=row['nombre'],
            #     usuario=row['email'],
            #     password=temp_password,
            #     pdf_adjunto="pdf_path",
            #     guid= v_guid
            # )
            # # El PDF se guarda en una carpeta 'storage/contratos_firmados/'
            # pdf_path = generar_pdf_contrato_final(row, nuevo_num, sig)
            
            return {"ok": True, "mensaje": "Contratación completada"}

    except Exception as e:
        conn.rollback()
        print(f"Error crítico en firma: {e}")
        raise HTTPException(500, "Error interno al procesar la firma")
    finally:
        conn.close()

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

@app.post("/api/rh/finalizar-alta")
async def finalizar_alta(data: dict):
    aspirante_id = data.get('aspirante_id')
    guid = data.get('guid')
    
    conn = db()
    try:
        with conn.cursor() as cur:
            # 1. Obtenemos datos del docente antes de cerrar
            # cursor.execute("SELECT nombre, correo FROM aspirantes WHERE id = %s", (aspirante_id,))
            # docente = cursor.fetchone()
            
            cur.execute("""
                SELECT f.aspirante_id, f.status, a.nombre, a.apellido_paterno, a.apellido_materno, a.email
                FROM firma_solicitudes f
                JOIN aspirantes a ON a.aspirante_id = f.aspirante_id
                WHERE a.guid=%s LIMIT 1
            """, (guid))
            row = cur.fetchone()


            if not row:
                return {"ok": False, "error": "Docente no encontrado"}

            # 2. Actualizamos a etapa 7 (Finalizado)
            cursor.execute("UPDATE aspirantes SET etapa_flujo = 7, estatus='COMPLETADO' WHERE id = %s", (aspirante_id,))
            conn.commit()
            
            if row["status"] == "SIGNED": return {"ok": True, "already": True}

            # 2. Datos de auditoría legal
            ip = request.client.host if request.client else "0.0.0.0"
            ua = request.headers.get("user-agent", "")[:255]
            aspirante_id = row["aspirante_id"]
            name = f"{row['nombre']} {row['apellido_paterno']} {row['apellido_materno']}".strip()

            # 3. Procesar Payload del borrador
            cur.execute("SELECT payload FROM contrato_borradores WHERE aspirante_id=%s AND is_active=1", (aspirante_id,))
            d = cur.fetchone()
            payload = json.loads(d["payload"] or "{}") if d else {}
            # Extraemos los datos del payload (Asegúrate que estos nombres coincidan con tus inputs del HTML)
            v_curp = payload.get("profesionista_curp", "").strip().upper()
            v_rfc  = payload.get("profesionista_rfc", "").strip().upper()
            v_tel  = payload.get("profesionista_telefono", "").strip()
            v_gen  = payload.get("profesionista_genero", "M") # Valor por defecto
            v_guid  = payload.get("guid", "") 
            # 4. Generar num_empleado Consecutivo (CUT-PROF-001)
            cur.execute("SELECT COUNT(*) as total FROM empleados WHERE num_empleado LIKE 'CUT-PROF-%'")
            count_res = cur.fetchone()
            consecutivo = (count_res['total'] or 0) + 1
            nuevo_num_empleado = f"CUT-PROF-{str(consecutivo).zfill(3)}"
            # Generar clave temporal de 8 caracteres
            temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
            hashed_pw = bcrypt.hash(temp_password)


             # B) Promover a tabla oficial 'profesionistas'
            cur.execute("""
                INSERT INTO empleados 
                (num_empleado, nombre, apellidos, genero, curp, rfc, 
                 telefono, departamento, puesto, fecha_ingreso, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'ACADEMICO', 'PROFESOR', CURDATE(), NOW())
            """, (
                nuevo_num_empleado, 
                row['nombre'], 
                apellidos, 
                v_gen, 
                v_curp, 
                v_rfc, 
                v_tel
            ))
            # --- CAPTURAMOS EL ID DEL EMPLEADO RECIÉN INSERTADO ---
            nuevo_empleado_id = cur.lastrowid

            cur.execute("""
                SELECT id, nombre_rol, slug
                FROM roles f
                WHERE nombre_rol="Profesor" LIMIT 1
            """)
            rol = cur.fetchone()

            # C) Insertar en USUARIOS (con force_change=1 para que la cambie al entrar)
            cur.execute("""
                INSERT INTO usuarios (email, password, rol_id, force_change, perfil_tipo, perfil_id, status)
                VALUES (%s, %s, %s, 1, "EMPLEADO", %s, 1)
            """, (
                row['email'],  # Corresponde al 1er %s
                hashed_pw,     # Corresponde al 2do %s
                rol['id'],      # Corresponde al 3er %s
                nuevo_empleado_id
            ))

            # 3. Envío de Correo Real vía SMTP
            enviar_correo_bienvenida(
                to_email=row['email'],
                nombre=row['nombre'],
                usuario=row['email'],
                password=temp_password,
                pdf_adjunto="pdf_path",
                guid= v_guid
            )
            
            return {"ok": True, "correo_enviado": enviado}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


@app.get("/api/rh/aspirantes/{guid}/comparison-data")
def get_comparison_data(guid: str):
    conn = db()
    print("sdlfsldfjlkdjflasdkjfldjkflsakdjflaskda")
    print(guid)
    try:
        with conn.cursor() as cur:
            # Consulta limpia sin hacks de collation
            cur.execute("""
                SELECT a.aspirante_id, ca.local_path as path_ine
                FROM aspirantes a
                LEFT JOIN contrato_adjuntos ca ON ca.borrador_guid = a.guid
                WHERE a.guid = %s AND ca.nombre = 'file_ine_vuelta'
                LIMIT 1
            """, (guid,))
            
            res_base = cur.fetchone()
            if not res_base:
                raise HTTPException(404, "No se encontró el aspirante o la INE trasera")

            # 2. Obtener la firma de la tabla firma_solicitudes
            cur.execute("""
                SELECT signature_png 
                FROM firma_solicitudes 
                WHERE aspirante_id = %s 
                ORDER BY created_at DESC LIMIT 1
            """, (res_base['aspirante_id'],))
            
            res_firma = cur.fetchone()
            
            # 3. Construir respuesta
            # Si signature_png es una ruta, la mandamos tal cual. 
            # Si es un Base64 (data:image/png;base64...), el frontend lo leerá igual en el src.
            print(res_firma['signature_png'])
            return {
                "path_ine_vuelta": res_base['path_ine'],
                "path_firma": res_firma['signature_png'] if res_firma else None
            }
    finally:
        conn.close()


# =========================================================
# Login
# =========================================================
class LoginBody(BaseModel):
    username: str
    password: str

def hash_password(password: str, salt: bytes | None = None) -> str:
    if salt is None:
        salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERS, dklen=32)
    # formato: pbkdf2$iters$salthex$hashhex
    return f"pbkdf2${PBKDF2_ITERS}${salt.hex()}${dk.hex()}"

def verify_password(password: str, stored: str) -> bool:
    # PROVISIONAL: Acepta 1234 sin importar el hash
    if password == "1234":
        return True
    try:
        algo, iters_s, salt_hex, hash_hex = stored.split("$")
        if algo != "pbkdf2":
            return False
        iters = int(iters_s)
        salt = bytes.fromhex(salt_hex)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iters, dklen=32)
        return hmac.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False
SESSION_HOURS = int(os.getenv("RH_SESSION_HOURS", "12"))

@app.post("/api/auth/login")
def auth_login(body: LoginBody):
    u = (body.username or "").strip()
    p = (body.password or "").strip()
    
    print("CONTRASEÑA admin123: ",bcrypt.hash("admin123"))
    if not u or not p:
        raise HTTPException(status_code=400, detail="Usuario y contraseña son obligatorios")

    conn = db()
    try:
        with conn.cursor() as cur:
            # Nueva consulta con JOIN a empleados y roles
            cur.execute("""
                SELECT 
                    u.id, 
                    u.email, 
                    u.password, 
                    u.status,
                    u.force_change,
                    r.nombre_rol AS rol,
                    e.nombre,
                    e.apellidos,
                    e.id AS empleado_id
                FROM usuarios u
                JOIN roles r ON u.rol_id = r.id
                JOIN empleados e ON u.perfil_id = e.id
                WHERE u.email = %s
                LIMIT 1
            """, (u))
            
            row = cur.fetchone()

            # Validar existencia y status
            if not row: #or int(row["status"]) != 1:
                raise HTTPException(status_code=401, detail="Credenciales inválidas o cuenta inactiva")
            password_bytes = p.encode('utf-8')
            stored_hash = row["password"]
            print(f"DEBUG: Hash recuperado de DB: '{stored_hash}'") # Veremos si hay espacios
            print(f"DEBUG: Largo del hash: {len(stored_hash)}")    # Debe ser 60
            print(f"DEBUG: Largo del hash: {bcrypt.hash('admin123')}")
            # Forzamos a que p sea string y comparamos con el hash de la DB
            try:
                # El secreto del éxito: asegurar que p sea un string limpio
                if not bcrypt.verify(p, stored_hash):
                    raise HTTPException(status_code=401, detail="Contraseña incorrecta")
            except ValueError as e:
                # Si Bcrypt sigue fallando, es por el formato del hash en la DB
                print(f"Error en Bcrypt: {e}")
                raise HTTPException(status_code=500, detail="Error interno de seguridad")
            
            # 3. Validar status activo
            if int(row["status"]) != 1:
                raise HTTPException(status_code=401, detail="Cuenta inactiva")   
            # Generar Sesión
            # token = secrets.token_hex(32)
            # expires_at = datetime.now() + timedelta(hours=SESSION_HOURS)

            # cur.execute("""
            #   INSERT INTO rh_sessions (user_id, token, expires_at)
            #   VALUES (%s,%s,%s)
            # """, (row["id"], token, expires_at))

            # Calcular iniciales para el avatar
            initials = f"{row['nombre'][0]}{row['apellidos'][0]}".upper()

            return {
                "ok": True,
                "user": {
                    "id": row["id"],
                    "email": row["email"],
                    "nombre_completo": f"{row['nombre']} {row['apellidos']}",
                    "rol": row["rol"],
                    "force_change": row["force_change"], # <--- Este campo es clave
                    "initials": initials
                }
            }
    finally:
        conn.close()


class ForceUpdateSchema(BaseModel):
    username: str
    new_password: str

@app.post("/api/auth/force-update")
def force_update_password(data: ForceUpdateSchema):

    print(f"Cambiar contraseña: {data.new_password}")
    # Encriptar la nueva contraseña
    hashed_pw = bcrypt.hash(data.new_password)

    print(f"hashed_pw: {hashed_pw}")
    conn = db()
    try:
        with conn.cursor() as cur:
            
            # Actualizar y quitar la bandera de force_change
            cur.execute("""
                UPDATE usuarios 
                SET password = %s, force_change = 0 
                WHERE email = %s
            """, (hashed_pw, data.username))
            
            conn.commit()
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
                
            return {"ok": True, "message": "Contraseña actualizada correctamente"}
    except Exception as e:
        conn.rollback()

        print(f"❌ hashed_pw: {str(e)}")
        raise HTTPException(500, "Error al actualizar credenciales")
    finally:
        conn.close()


def generar_pdf_final(datos_empleado, firma_b64):
    # Reutilizamos el HTML limpio que ya tenemos
    html_content = f"""
    <html>
        <body style="font-family: 'Times New Roman', serif; padding: 40px; font-size: 12px;">
            <h2 style="text-align:center;">CONTRATO DE PRESTACIÓN DE SERVICIOS</h2>
            <p>CONTRATO CELEBRADO ENTRE CUT UNIVERSIDAD LAGUNA Y <strong>{datos_empleado['nombre']} {datos_empleado['apellidos']}</strong>.</p>
            
            <p>...</p>

            <div style="margin-top: 50px; text-align: center;">
                <p><strong>FIRMADO ELECTRÓNICAMENTE</strong></p>
                <img src="data:image/png;base64,{firma_b64}" style="width: 200px; border-bottom: 1px solid #000;">
                <p>{datos_empleado['nombre']} {datos_empleado['apellidos']}</p>
                <p style="font-size: 9px; color: gray;">ID Empleado: {datos_empleado['num_empleado']} | Fecha: {datos_empleado['fecha_ingreso']}</p>
            </div>
        </body>
    </html>
    """
    ruta = f"storage/expedientes/contrato_{datos_empleado['num_empleado']}.pdf"
    pdfkit.from_string(html_content, ruta)
    return ruta

# =========================================================
# CORREOS
# =========================================================

def enviar_email_base(to_email, asunto, html_contenido, ruta_adjunto=None):
    # Configuración de tu servidor (Ajusta con tus credenciales)

    msg = MIMEMultipart()
    msg['From'] = f"Recursos Humanos CUT <{Config.SMTP_USER}>"
    msg['To'] = to_email
    msg['Subject'] = asunto

    # Cuerpo del correo
    msg.attach(MIMEText(html_contenido, 'html'))

    # Adjuntar archivo si existe
    if ruta_adjunto and os.path.exists(ruta_adjunto):
        with open(ruta_adjunto, "rb") as attachment:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(attachment.read())
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f"attachment; filename={os.path.basename(ruta_adjunto)}")
            msg.attach(part)

    # Envío
    try:
        server = smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT)
        server.starttls()
        server.login(Config.SMTP_USER, Config.SMTP_PASS)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Error SMTP: {e}")
        return False

# --- 1. INVITACIÓN ---
def enviar_correo_invitacion(to_email, nombre, url_acceso):

    asunto = "Invitación: Proceso de Contratación - CUT"
    cuerpo = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
        <div style="background: #b00020; padding: 20px; text-align: center; color: white;">
            <h2 style="margin: 0;">Bienvenido a CUT</h2>
        </div>
        <div style="padding: 30px; color: #333;">
            <p>Hola <strong>{nombre}</strong>,</p>
            <p>Se ha iniciado tu proceso de registro para integrarte al equipo académico de <strong>CUT Universidad</strong>.</p>
            <p>Para continuar, es necesario que completes tu información y subas tu documentación en el siguiente enlace:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{url_acceso}" style="background: #b00020; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Completar mi Expediente</a>
            </div>
            <p style="font-size: 13px; color: #666;">Este enlace es personal y único para tu proceso.</p>
        </div>
    </div>
    """
    return enviar_email_base(to_email, asunto, cuerpo)
# --- 2. EXPEDIENTE RECIBIDO ---
def enviar_correo_expediente_recibido(to_email, nombre):
    asunto = "Confirmación: Expediente Recibido - CUT"
    cuerpo = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
        <div style="background: #b00020; padding: 20px; text-align: center; color: white;">
            <h2 style="margin: 0;">Expediente en Sistema</h2>
        </div>
        
        <div style="padding: 30px; color: #333; line-height: 1.6;">
            <p>Hola <strong>{nombre}</strong>,</p>
            <p>Te informamos que tu documentación ha sido cargada exitosamente en nuestra plataforma de contratación.</p>
            
            <div style="background: #f1f3f7; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
                <span style="color: #b00020; font-weight: bold; font-size: 14px; text-transform: uppercase;">Estatus de tu trámite:</span><br>
                <span style="font-size: 18px; font-weight: 800; color: #121521;">DOCUMENTACIÓN COMPLETA</span>
            </div>

            <p>A partir de este momento, el departamento de <strong>Recursos Humanos</strong> iniciará la validación de tus datos. Este proceso puede demorar hasta <strong>24 horas hábiles</strong>.</p>
            
            <p>No es necesario que realices ninguna acción adicional. Te notificaremos por este medio en cuanto tu contrato esté listo para la firma electrónica.</p>
            
            <p style="font-size: 13px; color: #666; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">
                Atentamente,<br>
                <strong>Recursos Humanos - CUT Universidad</strong>
            </p>
        </div>
        
        <div style="background: #f6f7fb; padding: 15px; text-align: center; font-size: 11px; color: #999;">
            Este es un mensaje automático generado por el Sistema de Contratos CUT.
        </div>
    </div>
    """
    return enviar_email_base(to_email, asunto, cuerpo)
# --- 3. VALIDACIÓN (24 HORAS) ---
def enviar_correo_validacion_pendiente(to_email, nombre):
    asunto = "Expediente en revisión - CUT Universidad"
    cuerpo = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
        <div style="background: #b00020; padding: 20px; text-align: center; color: white;">
            <h2 style="margin: 0;">Expediente Recibido</h2>
        </div>
        <div style="padding: 30px; color: #333;">
            <p>Hola <strong>{nombre}</strong>,</p>
            <p>Hemos recibido correctamente tu información y documentos. Tu expediente ha entrado en la etapa de <strong>validación</strong> por parte de Recursos Humanos.</p>
            <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #b00020; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px;"><strong>Nota importante:</strong> La revisión se realizará en un plazo máximo de <strong>24 horas hábiles</strong>.</p>
            </div>
            <p>Una vez aprobado, recibirás un nuevo correo con la liga para realizar la <strong>firma electrónica de tu contrato</strong>.</p>
        </div>
    </div>
    """
    return enviar_email_base(to_email, asunto, cuerpo)
# --- 4. FIRMAR CONTRATO ---
def enviar_correo_firma(to_email: str, name: str, url: str) -> None:
    print("ENVIANDO CORREO DE FIRMA.........")
    if not Config.SMTP_ENABLED:
        print("[SMTP] SMTP_ENABLED=0 -> NO se envió correo de FIRMA. URL:", url)
        return

    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    subject = "PENDIENTE: Firma de Contrato de Prestación de Servicios - CUT"

    # --- Texto plano (fallback) ---
    text = f"""
        Hola {name},

        Tu expediente ha sido revisado y aprobado por Recursos Humanos. 
        Para formalizar tu relación con CUT, es necesario que realices la firma electrónica de tu contrato en la siguiente liga:

        {url}

        Este proceso es obligatorio para completar tu contratación.
        Si tienes dudas, contacta a la coordinación de Recursos Humanos.

        — CUT
        """

    # --- HTML con Estilo Institucional ---
    html = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif; line-height:1.6; background-color:#f4f4f7; padding:40px 20px;">
      <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:12px; 
                  overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1); border:1px solid #e1e4e8;">
        
        <div style="background:#b00020; padding:30px; text-align:center;">
          <h1 style="color:#ffffff; margin:0; font-size:22px; letter-spacing:1px;">FIRMA DE CONTRATO</h1>
        </div>

        <div style="padding:40px 35px;">
          <h2 style="color:#121521; margin-top:0; font-size:20px;">Estimado(a) {name},</h2>

          <p style="color:#4a5568; font-size:16px;">
            Nos complace informarte que tu expediente ha sido <strong>aprobado</strong>. El siguiente paso es la formalización legal mediante tu firma electrónica.
          </p>

          <div style="background:#fff8f1; border-left:4px solid #ff9800; padding:15px; margin:25px 0;">
            <p style="color:#856404; font-size:14px; margin:0;">
              <strong>Nota importante:</strong> Al dar clic en el botón, accederás al portal de firma digital segura. Asegúrate de leer cuidadosamente las cláusulas antes de estampar tu firma.
            </p>
          </div>

          <div style="text-align:center; margin:35px 0;">
            <a href="{url}"
               style="display:inline-block;
                      padding:16px 32px;
                      background:#b00020;
                      color:#ffffff;
                      text-decoration:none;
                      border-radius:8px;
                      font-weight:bold;
                      font-size:16px;
                      box-shadow:0 4px 6px rgba(176,0,32,0.2);">
              Revisar y Firmar Contrato
            </a>
          </div>

          <p style="color:#718096; font-size:14px;">
            Este enlace es único y personal. No lo compartas con nadie más.
          </p>

          <hr style="border:none; border-top:1px solid #edf2f7; margin:30px 0;">

          <p style="color:#a0aec0; font-size:12px; text-align:center;">
            Si el botón no funciona, copia este enlace en tu navegador:<br>
            <a href="{url}" style="color:#b00020; word-break:break-all;">{url}</a>
          </p>
        </div>

        <div style="background:#f8fafc; padding:20px; text-align:center; border-top:1px solid #edf2f7;">
          <p style="color:#64748b; font-size:12px; margin:0;">
            © 2026 CUT • Sistema de Gestión de Recursos Humanos<br>
            Este es un correo automático, por favor no respondas.
          </p>
        </div>
      </div>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"CUT Recursos Humanos <{Config.SMTP_FROM}>"
    msg["To"] = to_email

    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=20) as s:
            s.starttls()
            if Config.SMTP_USER:
                s.login(Config.SMTP_USER, Config.SMTP_PASS)
            s.sendmail(Config.SMTP_FROM, [to_email], msg.as_string())
            print(f"✅ Correo de FIRMA enviado a {to_email}")
    except Exception as e:
        print(f"[ERROR] Falló envío de firma a {to_email}: {e}")
# --- 3. BIENVENIDA Y ACCESOS (YA FIRMÓ) ---
def enviar_correo_bienvenida(to_email, nombre, usuario, password, pdf_adjunto,guid):
    asunto = "¡Felicidades! Bienvenido a CUT Universidad Laguna"
    cuerpo = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
        <div style="background: #b00020; padding: 20px; text-align: center; color: white;">
            <h2 style="margin: 0;">¡Bienvenido al Equipo!</h2>
        </div>
        <div style="padding: 30px; color: #333;">
            <p>Hola <strong>{nombre}</strong>,</p>
            <p>¡Tu proceso de contratación ha concluido con éxito! Tu contrato ha sido <strong>firmado electrónicamente</strong>.</p>
            <p>Adjunto encontrarás tu copia legal en PDF. Ya puedes acceder a la plataforma académica:</p>
            <div style="background: #fdf2f4; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #f8d7da;">
            <div style="text-align:center; margin:35px 0;">
                <a href="{Config.BASE_URL}/public/contratos.html?guid={guid}"
                style="display:inline-block;
                        padding:16px 32px;
                        background:#b00020;
                        color:#ffffff;
                        text-decoration:none;
                        border-radius:8px;
                        font-weight:bold;
                        font-size:16px;
                        box-shadow:0 4px 6px rgba(176,0,32,0.2);">
                Acceder a mi Cuenta
                </a>
            </div> 
                <p style="margin: 5px 0;"><strong>Usuario:</strong> {usuario}</p>
                <p style="margin: 5px 0;"><strong>Contraseña Temporal:</strong> <code>{password}</code></p>
            </div>
            <p style="font-size: 12px; color: #856404; background: #fff8e1; padding: 10px; border-radius: 5px;">
                <strong>Nota:</strong> El sistema te solicitará cambiar esta contraseña en tu primer inicio de sesión.
            </p>
        </div>
    </div>
    """
    return enviar_email_base(to_email, asunto, cuerpo, ruta_adjunto=pdf_adjunto)



# CONSTANCIAS
from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
import pymysql

router = APIRouter()

# --- MÉTODO PARA REGISTRAR CONSTANCIA ---
@app.post("/api/constancias/registrar")
async def registrar_constancia(id_alumno: int, id_tipo: int):
    # Calculamos vigencia (ejemplo: 3 meses a partir de hoy)
    fecha_vigencia = datetime.now() + timedelta(days=90)
    
    conexion = db() # Tu función de conexión a XAMPP
    try:
        with conexion.cursor() as cursor:
            # 1. Insertar registro en la tabla
            sql = """INSERT INTO registro_constancias 
                     (id_alumno, id_tipo, fecha_vigencia, estatus_pago) 
                     VALUES (%s, %s, %s, 'Pendiente')"""
            cursor.execute(sql, (id_alumno, id_tipo, fecha_vigencia))
            conexion.commit()
            
            # 2. Obtener datos del alumno para el correo
            cursor.execute("SELECT nombre, email FROM alumnos WHERE id = %s", (id_alumno,))
            alumno = cursor.fetchone()
            
            if alumno:
                # 3. Disparar Correo Real SMTP (Método 3 solicitado)
                # notify_document_generated es una de las funciones SMTP que definimos antes
                mensaje = f"Hola {alumno['nombre']}, se ha registrado tu solicitud de constancia. El estatus actual es: PENDIENTE DE PAGO."
                enviar_email_sistema(alumno['email'], "Registro de Constancia", mensaje)

        return {"status": "success", "message": "Constancia registrada y correo enviado"}
    
    except Exception as e:
        conexion.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conexion.close()

@app.get("/api/constancias/listado")
async def obtener_listado():
    conexion = db()
    try:
        with conexion.cursor() as cursor:
            # Unimos las 3 tablas para tener la información completa
            query = """
                SELECT r.id_registro, a.nombre as nombre_alumno, a.matricula, 
                       c.nombre_tipo, r.fecha_solicitud, r.estatus_pago
                FROM registro_constancias r
                JOIN alumnos a ON r.id_alumno = a.id
                JOIN cat_tipo_constancia c ON r.id_tipo = c.id_tipo
                ORDER BY r.fecha_solicitud DESC
            """
            cursor.execute(query)
            return cursor.fetchall()
    finally:
        conexion.close()
