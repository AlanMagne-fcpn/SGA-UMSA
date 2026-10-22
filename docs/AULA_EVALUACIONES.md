# Aula y evaluación de actividades

Al crear o editar una actividad, coordinadores y superadministradores configuran **Permisos de contenido del ponente**. Este formulario solo habilita contenidos; no sube archivos ni abre el editor. Los permisos se guardan junto con los datos de la actividad. Las actividades nuevas comienzan con los permisos desactivados.

El ponente asignado sube los contenidos desde **Editar aula virtual** en su panel. Solo aparecen los tipos de contenido habilitados por la organización. Los permisos se comprueban también en el servidor, incluidas las subidas de archivos. Solo los estudiantes con inscripción aceptada pueden acceder al contenido publicado.

**Únicamente las actividades de tipo Curso admiten prácticas, cuestionarios y exámenes**, incluidas las preguntas después de un video. Los simposios, conferencias, talleres, diplomados y otros tipos solo admiten videos sin evaluaciones y archivos. Los contenidos evaluativos antiguos de esos otros tipos se conservan en la base de datos, pero no se muestran en el aula ni se incluyen en la nota.

El editor permite crear:

- Videos subidos (MP4, WebM, OGG o MOV, hasta 500 MB) o enlaces HTTPS directos a videos, con cuestionario opcional.
- Materiales de estudio y archivos adjuntos (PDF, documentos de Office, texto, imágenes o ZIP, hasta 25 MB por archivo).
- Cuestionarios y exámenes de opción única, corregidos por el servidor. Los reintentos conservan la mejor nota.
- Prácticas con respuesta escrita y/o archivo. El docente descarga la entrega, asigna una nota de 0 a 100 y escribe su devolución.

Los borradores no aparecen al estudiante. Los materiales y los videos sin preguntas no aportan nota. Cada evaluación publicada tiene un peso configurable; los pesos se normalizan al 100%. Un peso cero excluye esa evaluación de la nota. Por ejemplo, pesos 30/20/50 con notas 80/90/60 producen 72/100. Las evaluaciones sin responder o calificar aportan cero a la nota acumulada.

La sección **Entregas y calificaciones** muestra los trabajos enviados. Mientras una práctica esté pendiente de calificación, el estudiante puede reemplazar su entrega. Después de calificada queda cerrada; el docente puede revisar su nota.

La emisión de certificados verifica las evaluaciones publicadas y la asistencia mínima configurada. En modalidad virtual, la participación se mide mediante el avance del aula; en las otras modalidades se utiliza la asistencia registrada. Las evaluaciones sin terminar o las prácticas pendientes de calificación bloquean la emisión.

- Nota igual o superior a la mínima y asistencia suficiente: plantilla de aprobación.
- Nota inferior a la mínima y asistencia suficiente: plantilla de participación.
- Asistencia insuficiente: no se emite certificado.
- Un aula sin evaluaciones solo acredita participación.

El evento debe tener configuradas ambas plantillas. La variable `{CARGA_HORARIA}` solo acredita horas al estudiante en la plantilla de aprobación; en participación se sustituye por vacío. El texto fijo o las horas impresas dentro de una imagen de plantilla deben ajustarse al configurar esa plantilla.

Las entregas de prácticas se almacenan en `backend/private/curso-entregas`, fuera de los archivos públicos. Su descarga requiere autenticación y ser el propietario o tener permisos de edición sobre la actividad. Esta carpeta debe incluirse en las copias de seguridad del servidor.

## Instalación y comprobación

En backend, ejecutar `npm run migration:run` antes de iniciar la versión nueva. La migración `1792100000000-ExtendAulaEvaluaciones` añade recursos, pesos, entregas y calificaciones sin eliminar los contenidos anteriores.

Pruebas del backend: `npm test -- --runInBand actividades-academicas.service.spec.ts certificados-aula.spec.ts`. Después de compilar, `node scripts/test-aula-integration.js` comprueba el cálculo en PostgreSQL mediante tablas temporales y una transacción que se revierte.

Pruebas de interfaz: desde frontend, `npx playwright test tests/aula-actividad.spec.ts tests/actividad-edicion.spec.ts`.
