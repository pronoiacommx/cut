# CUT - Contratos (HTML + Python)

Incluye:
- `index.html`: formulario minimalista gris/rojo.
- `app.py`: API FastAPI (multipart) que:
  1) recibe datos + anexos
  2) llena plantilla DOCX con tokens
  3) convierte DOCX -> PDF
  4) (opcional) sube todo a Google Drive con Service Account
- `template_tokens.json`: tokens disponibles para la plantilla.

---

## 1) Preparar la plantilla DOCX (PASO CLAVE)
Copia tu machote a:

`template/contrato_template.docx`

y reemplaza los espacios/guiones del machote por tokens con doble llave, por ejemplo:

- `{{PROFESIONISTA_NOMBRE}}`
- `{{PROFESIONISTA_DOMICILIO_FISCAL}}`
- `{{PROFESIONISTA_RFC}}`
- `{{SERVICIO_MATERIA}}`
- `{{PAGO_TOTAL_SEMESTRE}}`
- `{{PAGO_TOTAL_LETRA}}`
- `{{FECHA_HOY}}`

Tokens disponibles: `template_tokens.json`.

---

## 2) Instalar y correr
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Abre:
- http://localhost:8000/

---

## 3) DOCX -> PDF (LibreOffice)
Instala LibreOffice.

En Mac, normalmente el bin está aquí:
`/Applications/LibreOffice.app/Contents/MacOS/soffice`

Ejemplo:
```bash
export SOFFICE_BIN="/Applications/LibreOffice.app/Contents/MacOS/soffice"
```

---

## 4) Google Drive (opcional)
Recomendado: Service Account.

Variables:
```bash
export GDRIVE_ENABLED=1
export GDRIVE_SERVICE_ACCOUNT_JSON="/ruta/service-account.json"
export GDRIVE_PARENT_FOLDER_ID="..."  # opcional
```

---

## 5) Firma digital
Este entregable deja el PDF listo. La firma formal normalmente se integra con DocuSign/Adobe Sign/Dropbox Sign.
