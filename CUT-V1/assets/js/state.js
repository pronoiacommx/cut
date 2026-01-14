export const state = {
  user: {
    nombre: "Juan Pérez",
    matricula: "A-10293",
    grupo: "Lic. 6°",
    turno: "MATUTINO",
    status_pago: "VIGENTE",
    email: "juan@correo.com",
    telefono: "+52 871 000 0000",
    last_login: "2026-01-05 09:12"
  },
  calificaciones: [
    { periodType:"CUATRIMESTRE", period:1, materia:"Matemáticas I", p1:10, p2:9, final:10 },
    { periodType:"CUATRIMESTRE", period:1, materia:"Bases de Datos I", p1:9, p2:8, final:9 },
    { periodType:"CUATRIMESTRE", period:1, materia:"Historia", p1:9, p2:8, final:9 },
    { periodType:"CUATRIMESTRE", period:2, materia:"Matemáticas II", p1:9, p2:9, final:9 }
  ],
  pagos: [
    { fecha:"2025-12-24", concepto:"Mensualidad", monto:1200, estado:"CONFIRMADO" },
    { fecha:"2025-11-24", concepto:"Mensualidad", monto:1200, estado:"EN PROCESO" },
    { fecha:"2025-10-24", concepto:"Inscripción", monto:1800, estado:"CONFIRMADO" }
  ],
  clases: [
    { materia:"Matemáticas", docente:"Mtra. López", aula:"3B", recursos:[{label:"Material", href:"#"}, {label:"Meet", href:"#"}] },
    { materia:"Inglés", docente:"Mtra. Salas", aula:"4A", recursos:[{label:"Classroom", href:"#"}] }
  ],
  horarios: [
    { dia:"Lunes", hora:"09:00 - 09:45", materia:"Matemáticas", aula:"3B" },
    { dia:"Lunes", hora:"09:45 - 10:30", materia:"Inglés", aula:"4A" },
    { dia:"Lunes", hora:"10:30 - 10:45", materia:"RECESO", aula:"—", tipo:"RECESO" },
    { dia:"Lunes", hora:"10:45 - 11:30", materia:"Español", aula:"2A" },
    { dia:"Martes", hora:"09:00 - 09:45", materia:"Inglés", aula:"4A" },
    { dia:"Martes", hora:"09:45 - 10:30", materia:"Matemáticas", aula:"3B" },
    { dia:"Martes", hora:"10:30 - 10:45", materia:"RECESO", aula:"—", tipo:"RECESO" },
    { dia:"Miércoles", hora:"09:00 - 09:45", materia:"Ciencias", aula:"Lab 1" },
    { dia:"Miércoles", hora:"10:30 - 10:45", materia:"RECESO", aula:"—", tipo:"RECESO" },
    { dia:"Jueves", hora:"09:00 - 09:45", materia:"Arte", aula:"Taller" },
    { dia:"Viernes", hora:"09:00 - 09:45", materia:"Tutoría", aula:"3B" },
  ]
};
