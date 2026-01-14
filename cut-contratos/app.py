from __future__ import annotations

import os
import json
import subprocess
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from docxtpl import DocxTemplate

# Google Drive
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload


BASE_DIR = Path(__file__).resolve().parent
TEMPLATE_DIR = BASE_DIR / "template"
STORAGE_DIR = BASE_DIR / "storage"
OUT_DIR = STORAGE_DIR / "out"
UPLOADS_DIR = STORAGE_DIR / "uploads"

TOKENS_FILE = BASE_DIR / "template_tokens.json"
TEMPLATE_FILE = TEMPLATE_DIR / "contrato_template.docx"

# Drive config (Service Account)
GDRIVE_ENABLED = os.getenv("GDRIVE_ENABLED", "0") == "1"
GDRIVE_SERVICE_ACCOUNT_JSON = os.getenv("GDRIVE_SERVICE_ACCOUNT_JSON", "")
GDRIVE_PARENT_FOLDER_ID = os.getenv("GDRIVE_PARENT_FOLDER_ID", "")

# LibreOffice binary
SOFFICE_BIN = os.getenv("SOFFICE_BIN", "soffice")  # Mac: /Applications/LibreOffice.app/Contents/MacOS/soffice

app = FastAPI(title="CUT Contratos API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ajusta a tu dominio en producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sirve el HTML en /
app.mount("/", StaticFiles(directory=str(BASE_DIR), html=True), name="static")
# Sirve generados en /files/...
app.mount("/files", StaticFiles(directory=str(OUT_DIR)), name="files_out")


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
    folder = service.files().create(body=meta, fields="id").execute()
    return folder["id"]


def drive_upload_file(service, filepath: Path, parent_id: str, mime: str) -> str:
    media = MediaFileUpload(str(filepath), mimetype=mime, resumable=True)
    body = {"name": filepath.name, "parents": [parent_id]}
    f = service.files().create(body=body, media_body=media, fields="id").execute()
    return f["id"]


@app.get("/health")
def health():
    return {"ok": True, "ts": datetime.utcnow().isoformat() + "Z"}


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
    folder_name = f"{safe_name}_{profesionista_rfc}_{run_id}"
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

    # Drive (opcional)
    drive_info = None
    try:
        if GDRIVE_ENABLED:
            service = drive_client()
            folder_id = drive_mkdir(service, folder_name, GDRIVE_PARENT_FOLDER_ID or None)

            docx_id = drive_upload_file(
                service, out_docx, folder_id,
                mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
            pdf_id = drive_upload_file(service, out_pdf, folder_id, mime="application/pdf")

            for p in uploads_dir.iterdir():
                drive_upload_file(service, p, folder_id, mime="application/octet-stream")

            drive_info = {
                "folder_name": folder_name,
                "folder_id": folder_id,
                "docx_file_id": docx_id,
                "pdf_file_id": pdf_id,
            }
    except Exception as e:
        drive_info = {"warning": str(e)}

    return JSONResponse({
        "ok": True,
        "run_id": run_id,
        "local_docx_url": f"/files/{folder_name}/{out_docx.name}",
        "local_pdf_url": f"/files/{folder_name}/{out_pdf.name}",
        "drive": drive_info,
        "folder": folder_name
    })
