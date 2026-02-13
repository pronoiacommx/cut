import pandas as pd
import mysql.connector

# Configuración de BD
db_config = {
    'host': '127.0.0.1',
    'user': 'cut_user',
    'password': 'cutlaguna',
    'database': 'cutlaguna'
}

def procesar_rvoe(file_path):
    # Leer el archivo (ajustar el skiprows según tu Excel real)
    df = pd.read_csv(file_path, header=2) 
    
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()

    for _, row in df.iterrows():
        if pd.isna(row['RVOE']): continue

        # 1. Insertar en tabla RVOES
        sql_rvoe = """INSERT INTO rvoes (rvoe_numero, fecha_otorgamiento, institucion, 
                      nivel_estudios, nombre_programa, modalidad, total_creditos) 
                      VALUES (%s, %s, %s, %s, %s, %s, %s)"""
        
        # Manejo de fecha (asumiendo formato YYYY-MM-DD)
        valores_rvoe = (row['RVOE'], row['FEECHA DE OTORGAMIENTO DE RVOE'], 
                        row['NOMBRE DE LA INSTITUCIÓN'], row['NIVEL DE ESTUDIOS'], 
                        row['NOMBRE DEL PROGRAMA'], row['MODALIDAD'], row['TOTAL DE CRÉDITOS'])
        
        cursor.execute(sql_rvoe, valores_rvoe)
        rvoe_id = cursor.lastrowid

        # 2. Insertar Materias (Iteramos por los cuatrimestres que vienen en columnas)
        # Según tu archivo, se repiten grupos de 4 columnas: Asignatura, Clave, Horas, Créditos
        # Iteramos hasta 4 cuatrimestres (puedes ampliarlo)
        col_offset = 12 # Donde empieza la primera asignatura
        for cuatri in range(1, 5):
            idx = col_offset + ((cuatri - 1) * 4)
            
            # Extraemos las 4 columnas del cuatrimestre actual
            try:
                materias_en_fila = df[df['RVOE'] == row['RVOE']] # Por si hay materias en filas de abajo
                
                for _, m_row in materias_en_fila.iterrows():
                    nombre_materia = m_row.iloc[idx]
                    clave_materia = m_row.iloc[idx+1]
                    horas = m_row.iloc[idx+2]
                    creditos = m_row.iloc[idx+3]

                    if pd.notna(nombre_materia) and str(nombre_materia).strip() != "":
                        sql_materia = """INSERT INTO rvoe_materias 
                                        (rvoe_id, cuatrimestre_numero, asignatura, clave, horas_docente, creditos) 
                                        VALUES (%s, %s, %s, %s, %s, %s)"""
                        cursor.execute(sql_materia, (rvoe_id, cuatri, nombre_materia, clave_materia, horas, creditos))
            except IndexError:
                break # No hay más columnas de cuatrimestres

    conn.commit()
    cursor.close()
    conn.close()
    print("¡Importación exitosa!")

# Ejecutar
procesar_rvoe('EJEMPLO_DE_RVOE.csv')