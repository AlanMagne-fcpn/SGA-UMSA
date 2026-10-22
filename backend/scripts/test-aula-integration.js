require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const assert = require('node:assert/strict');
const { resumenAula } = require('../dist/src/modules/Academico/actividades-academicas/aula-resumen');
const { requisitosCertificadoAula } = require('../dist/src/modules/Academico/actividades-academicas/certificacion-aula');

async function main() {
  const db = new Client({ host: process.env.DATABASE_HOST, port: Number(process.env.DATABASE_PORT), user: process.env.DATABASE_USER, password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
  await db.connect();
  const adapter = { query: async (...args) => (await db.query(...args)).rows };
  try {
    await db.query('BEGIN');
    // Tablas temporales: no se alteran estudiantes, notas ni cursos reales.
    await db.query(`CREATE TEMP TABLE actividades_academicas (id int, tipo text); INSERT INTO actividades_academicas VALUES (7,'Curso'); CREATE TEMP TABLE curso_lecciones (id int, id_actividad_academica int, tipo text, preguntas jsonb DEFAULT '[]', peso numeric, publicado bool);
      CREATE TEMP TABLE curso_progreso (id int, id_leccion int, id_usuario int, nota numeric);
      INSERT INTO curso_lecciones VALUES (1,7,'video','[{"opciones":["A","B"]}]',30,true),(2,7,'practica','[]',20,true),(3,7,'examen','[{}]',50,true),(4,7,'material','[]',0,true),(5,7,'examen','[{}]',99,false);
      INSERT INTO curso_progreso VALUES (1,1,9,80),(2,2,9,NULL);`);
    let result = await resumenAula(adapter, 7, 9);
    assert.equal(result.promedio, 24);
    assert.equal(result.pendientes, 1);
    assert.equal(result.completadas, 1);
    await assert.rejects(() => requisitosCertificadoAula(adapter,7,9,{tipo:'Virtual',min_asistencia:80}), /pendientes/);
    await db.query('UPDATE curso_progreso SET nota=90 WHERE id=2; INSERT INTO curso_progreso VALUES (3,3,9,60),(4,4,9,NULL)');
    result = await resumenAula(adapter, 7, 9);
    assert.equal(result.promedio, 72); // 80×30% + 90×20% + 60×50%
    assert.equal(result.terminado, true);
    assert.equal(result.evaluadas, 3);
    let certificado = await requisitosCertificadoAula(adapter,7,9,{tipo:'Virtual',min_asistencia:80});
    assert.equal(certificado.nota, 72);
    assert.equal(certificado.asistenciaVirtual, true);
    await db.query('DELETE FROM curso_progreso WHERE id=4');
    certificado = await requisitosCertificadoAula(adapter,7,9,{tipo:'Virtual',min_asistencia:80});
    assert.equal(certificado.asistenciaVirtual, false);
    await db.query("UPDATE actividades_academicas SET tipo='Simposio'");
    result = await resumenAula(adapter, 7, 9);
    assert.equal(result.total, 2);
    assert.equal(result.evaluaciones, 0);
    assert.equal(result.promedio, null);
    console.log('Aula: ponderación 30/20/50, pendientes, borradores, avance y requisitos de certificado verificados en PostgreSQL.');
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
