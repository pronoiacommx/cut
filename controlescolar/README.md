# Prospectos Escuela (v1) – Opción A
Captura pública de prospectos + auto-asignación al vendedor con menor carga + vista vendedor (demo).

## Requisitos
- PHP 8+
- MySQL 8+ (o MariaDB compatible)
- (Opcional) Composer NO requerido para esta demo

## 1) Crear BD
1. Crea una base:
   - `CREATE DATABASE prospectos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
2. Importa:
   - `db/schema.sql`
   - `db/seed.sql`

> Usuarios demo (password: 123456)
- admin@demo.com
- vend1@demo.com
- vend2@demo.com

## 2) Levantar API (servidor built-in)
Desde la carpeta `api/`:

### macOS / Linux
```bash
export DB_HOST=127.0.0.1
export DB_NAME=prospectos
export DB_USER=root
export DB_PASS=""
php -S localhost:8080 -t public
```

### Windows (PowerShell)
```powershell
$env:DB_HOST="127.0.0.1"
$env:DB_NAME="prospectos"
$env:DB_USER="root"
$env:DB_PASS=""
php -S localhost:8080 -t public
```

Prueba health:
- GET http://localhost:8080/api/health

## 3) Abrir front
Abre `web/index.html` en tu navegador.
- Tab "Captura prospecto": crea prospecto y se asigna automáticamente.
- Tab "Vista vendedor": login vend1@demo.com / 123456 y ve “mis prospectos”.

## Endpoints relevantes
- POST `/api/prospects/intake` (público): crea + auto-assign
- POST `/api/login`
- GET  `/api/prospects` (requiere Bearer token; vendedor ve solo sus prospectos)

## Notas
- La validación de CURP aquí es básica (formato). Luego podemos agregar verificador.
- La auto-asignación usa “menor carga” (COUNT de prospectos activos).
