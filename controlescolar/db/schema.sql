-- Prospectos Escuela (v1) - Opción A (Captura + Auto-asignación)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS roles (
  id TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT IGNORE INTO roles(id,nombre) VALUES
(1,'ADMIN'),(2,'VENDEDOR'),(3,'CERRADOR'),(4,'CONTROL_ESCOLAR'),(5,'ALUMNO');

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  rol_id TINYINT UNSIGNED NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  telefono VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuarios_roles FOREIGN KEY (rol_id) REFERENCES roles(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_tokens (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  token CHAR(64) NOT NULL UNIQUE,
  expira_en DATETIME NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tokens_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  INDEX idx_tokens_usuario (usuario_id),
  INDEX idx_tokens_expira (expira_en)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pipeline_etapas (
  id TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  clave VARCHAR(30) NOT NULL UNIQUE,
  nombre VARCHAR(60) NOT NULL,
  orden TINYINT UNSIGNED NOT NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO pipeline_etapas(id,clave,nombre,orden) VALUES
(1,'NUEVO','Nuevo',1),
(2,'ASIGNADO_VENDEDOR','Asignado a vendedor',2),
(3,'EN_SEGUIMIENTO','En seguimiento',3),
(4,'VALIDADO_VENDEDOR','Validado por vendedor',4),
(5,'ASIGNADO_CERRADOR','Asignado a cerrador',5),
(6,'VALIDADO_CERRADOR','Validado por cerrador',6),
(7,'ENVIADO_CONTROL_ESCOLAR','Enviado a control escolar',7),
(8,'INSCRITO','Inscrito',8),
(9,'DESCARTADO','Descartado',99);

CREATE TABLE IF NOT EXISTS prospectos (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  interes ENUM('FRIO','MEDIO','CALIENTE') NOT NULL DEFAULT 'FRIO',
  nombre_completo VARCHAR(160) NULL,
  curp VARCHAR(18) NULL,
  email VARCHAR(190) NULL,
  telefono VARCHAR(30) NULL,
  etapa_id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  vendedor_id BIGINT UNSIGNED NULL,
  cerrador_id BIGINT UNSIGNED NULL,
  validado_vendedor TINYINT(1) NOT NULL DEFAULT 0,
  validado_cerrador TINYINT(1) NOT NULL DEFAULT 0,
  fuente VARCHAR(80) NULL,
  campaña VARCHAR(80) NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_prospectos_etapa FOREIGN KEY (etapa_id) REFERENCES pipeline_etapas(id),
  CONSTRAINT fk_prospectos_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios(id),
  CONSTRAINT fk_prospectos_cerrador FOREIGN KEY (cerrador_id) REFERENCES usuarios(id),

  INDEX idx_prospectos_etapa (etapa_id),
  INDEX idx_prospectos_interes (interes),
  INDEX idx_prospectos_vendedor (vendedor_id),
  INDEX idx_prospectos_cerrador (cerrador_id),
  UNIQUE KEY uq_prospectos_curp (curp),
  UNIQUE KEY uq_prospectos_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prospecto_historial (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  prospecto_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NULL,
  accion VARCHAR(40) NOT NULL,
  detalle JSON NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hist_prospecto FOREIGN KEY (prospecto_id) REFERENCES prospectos(id),
  CONSTRAINT fk_hist_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  INDEX idx_hist_prospecto (prospecto_id),
  INDEX idx_hist_fecha (creado_en)
) ENGINE=InnoDB;
