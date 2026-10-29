import { Seeder } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { Evento } from '../../../modules/Academico/eventos/entities/evento.entity';
import { ActividadAcademica } from '../../../modules/Academico/actividades-academicas/entities/actividad-academica.entity';
import { Usuario } from '../../../modules/Usuario/usuarios/entities/usuario.entity';
import { Imparticion } from '../../../modules/Academico/imparticiones/entities/imparticion.entity';
import { CoordinacionEvento } from '../../../modules/Academico/coordinaciones/entities/coordinacion.entity';

export default class EventosSeeder implements Seeder {
  private async asegurarHorario(dataSource: DataSource, actividadId: number, inicio: Date, fin: Date) {
    const modalidades = await dataSource.query(
      `SELECT id FROM curso_modalidades WHERE id_actividad_academica = $1 ORDER BY id LIMIT 1`,
      [actividadId],
    );
    let modalidadId = modalidades[0]?.id;
    if (!modalidadId) {
      const creada = await dataSource.query(
        `INSERT INTO curso_modalidades (id_actividad_academica, tipo, min_nota, min_asistencia)
         VALUES ($1, 'Presencial', 51, 80) RETURNING id`,
        [actividadId],
      );
      modalidadId = creada[0].id;
    }

    const actuales = await dataSource.query(
      `SELECT COUNT(*)::int AS total FROM sesiones_academicas WHERE id_curso_modalidad = $1`,
      [modalidadId],
    );
    if (Number(actuales[0].total) > 0) return;

    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const cursor = new Date(inicio);
    const limite = new Date(fin);
    let creadas = 0;
    while (cursor <= limite && creadas < 12) {
      const fecha = cursor.toISOString().slice(0, 10);
      await dataSource.query(
        `INSERT INTO sesiones_academicas (id_curso_modalidad, dia, fecha, hora_inicio, hora_fin, modalidad)
         VALUES ($1, $2, $3, '09:00', '12:00', 'Presencial')`,
        [modalidadId, dias[cursor.getUTCDay()], fecha],
      );
      cursor.setUTCDate(cursor.getUTCDate() + 14);
      creadas += 1;
    }
  }

  public async run(dataSource: DataSource): Promise<void> {
    const eventoRepository = dataSource.getRepository(Evento);
    const actividadRepository = dataSource.getRepository(ActividadAcademica);
    const userRepository = dataSource.getRepository(Usuario);
    const imparticionRepository = dataSource.getRepository(Imparticion);

    const eventosData = [
      {
        nombre: 'Congreso Internacional TWAS-TYAN 2025',
        descripcion: 'Un evento de talla mundial donde la ciencia latinoamericana converge en La Paz para discutir temas de actualidad, desarrollo y sostenibilidad, enfocados en el progreso de la región y sus desafíos futuros.',
        gestion: '2026',
        version: '1ra Edición',
        ubicacion: 'La Paz, Bolivia',
        direccion: 'Campus Central UMSA, Avenida Villazón',
        fecha_inicio: new Date('2026-10-01'),
        fecha_fin: new Date('2027-06-30'),
        estado: 1,
        logo: 'logo CMS.jpg',
        telefono: '+591 76706873',
        email: 'twas-unesco@umsa.bo',
        organizadores: 'TWAS, TYAN, UMSA, FCPN, Carrera de Química, Ingeniería Química, Embajada de Brasil',
        imagen_fondo: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1600&q=80',
        actividades: [
          {
            nombre: 'Simposio sobre Biología Molecular',
            descripcion: 'Conferencias magistrales sobre los últimos avances en el campo.',
            tipo: 'Simposio',
            fecha_inicio: new Date('2026-10-01'),
            fecha_fin: new Date('2027-06-30'),
            imagen: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=1600&q=85',
            requisitos: { base: { nombres: true, primer_apellido: true, email: true, documento_identidad: true, celular: true }, custom: [] }
          },
          {
            nombre: 'Taller de Redacción Científica',
            descripcion: 'Estrategias y mejores prácticas para publicar en revistas de alto impacto.',
            tipo: 'Taller',
            fecha_inicio: new Date('2026-11-01'),
            fecha_fin: new Date('2027-03-31'),
            imagen: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1600&q=85',
            requisitos: { base: { nombres: true, primer_apellido: true, email: true }, custom: [{ label: 'Título del Articulo a Redactar', type: 'text' }] }
          },
          {
            nombre: 'Panel: Cambio Climático en los Andes',
            descripcion: 'Mesa de discusión con expertos locales e internacionales.',
            tipo: 'Panel',
            fecha_inicio: new Date('2026-11-15'),
            fecha_fin: new Date('2027-04-30'),
            imagen: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&q=85',
            requisitos: { base: { nombres: true, primer_apellido: true, email: true, pais_origen: true }, custom: [] }
          }
        ]
      },
      {
        nombre: 'Feria de Innovación Tecnológica 2026',
        descripcion: 'Muestra abierta al público de los proyectos tecnológicos más prometedores desarrollados por jóvenes investigadores de Latinoamérica.',
        gestion: '2026',
        version: '2da Edición',
        ubicacion: 'Santa Cruz, Bolivia',
        direccion: 'Centro de Convenciones Expocruz',
        fecha_inicio: new Date('2026-10-01'),
        fecha_fin: new Date('2027-04-30'),
        estado: 1,
        logo: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1600&q=80',
        imagen_fondo: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1600&q=80',
        actividades: [
          {
            nombre: 'Conferencia: IA en la educación',
            descripcion: 'Cómo la inteligencia artificial está remodelando el aprendizaje.',
            tipo: 'Conferencia',
            fecha_inicio: new Date('2026-10-15'),
            fecha_fin: new Date('2027-01-31'),
            imagen: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1600&q=85',
            requisitos: { base: { nombres: true, primer_apellido: true, email: true, documento_identidad: true }, custom: [] }
          },
          {
            nombre: 'Bootcamp de Programación Reactiva',
            descripcion: 'Taller intensivo para aprender Vue y React enfocados en rendimiento.',
            tipo: 'Bootcamp',
            fecha_inicio: new Date('2026-11-01'),
            fecha_fin: new Date('2027-02-28'),
            imagen: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1600&q=85',
            requisitos: { base: { nombres: true, primer_apellido: true, email: true, celular: true }, custom: [{ label: 'Nivel de Programación', type: 'select', options: ['Básico', 'Intermedio', 'Avanzado'] }] }
          }
        ]
      },
      {
        nombre: 'Diplomado en Inteligencia Artificial y Ciencia de Datos',
        descripcion: 'Programa de postgrado avanzado diseñado para profesionales que buscan dominar las herramientas de IA, Machine Learning y Big Data aplicadas a la industria actual.',
        gestion: '2026',
        version: '4ta Versión',
        ubicacion: 'Virtual / Online',
        direccion: 'Plataforma LMS TYAN',
        fecha_inicio: new Date('2026-10-01'),
        fecha_fin: new Date('2027-06-30'),
        estado: 1,
        logo: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1600&q=80',
        imagen_fondo: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1600&q=80',
        actividades: [
          {
            nombre: 'Módulo I: Fundamentos de Python para Data Science',
            descripcion: 'Primer paso en el dominio de la ciencia de datos utilizando el lenguaje más potente del mercado.',
            tipo: 'Diplomado',
            fecha_inicio: new Date('2026-10-01'),
            fecha_fin: new Date('2027-01-31'),
            imagen: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1600&q=85',
            requisitos: { base: { nombres: true, primer_apellido: true, email: true, documento_identidad: true, grado_academico: true }, custom: [] }
          },
          {
            nombre: 'Módulo II: Deep Learning y Redes Neuronales',
            descripcion: 'Estudio profundo de arquitecturas complejas y entrenamiento de modelos inteligentes.',
            tipo: 'Diplomado',
            fecha_inicio: new Date('2027-02-01'),
            fecha_fin: new Date('2027-06-30'),
            imagen: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=1600&q=85',
            requisitos: { base: { nombres: true, primer_apellido: true, email: true, afiliacion: true }, custom: [{ label: '¿Tiene conocimientos de Cálculo?', type: 'select', options: ['Si', 'No'] }] }
          }
        ]
      },
      {
        nombre: 'Cumbre Panamericana de Energías Renovables 2025',
        descripcion: 'Encuentro de líderes y expertos internacionales para discutir la transición hacia matrices energéticas sostenibles en el continente.',
        gestion: '2026',
        version: 'I Edición',
        ubicacion: 'Cochabamba, Bolivia',
        direccion: 'Auditorio Central Gran Hotel Cochabamba',
        fecha_inicio: new Date('2026-11-01'),
        fecha_fin: new Date('2027-03-31'),
        estado: 1,
        logo: 'https://images.unsplash.com/photo-1466611653911-954ffaa137a8?w=1600&q=80',
        imagen_fondo: 'https://images.unsplash.com/photo-1466611653911-954ffaa137a8?w=1600&q=80',
        actividades: [
          {
            nombre: 'Seminario: El Potencial del Litio en la Región',
            descripcion: 'Perspectivas económicas y tecnológicas sobre la extracción y uso del litio.',
            tipo: 'Seminario',
            fecha_inicio: new Date('2026-11-01'),
            fecha_fin: new Date('2027-02-28'),
            imagen: 'https://images.unsplash.com/photo-1536939459926-301728717817?w=1600&q=85',
            requisitos: { base: { nombres: true, primer_apellido: true, email: true, documento_identidad: true, pais_origen: true }, custom: [] }
          }
        ]
      },
      {
        nombre: 'Workshop Internacional: Biotecnología Avanzada',
        descripcion: 'Taller práctico intensivo sobre edición genética y bioprocesos industriales.',
        gestion: '2026',
        version: 'Edición Verano',
        ubicacion: 'Sucre, Bolivia',
        direccion: 'Laboratorios de Genética Universidad USFX',
        fecha_inicio: new Date('2026-11-01'),
        fecha_fin: new Date('2027-04-30'),
        estado: 1,
        logo: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=1600&q=80',
        imagen_fondo: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=1600&q=80',
        actividades: [
          {
            nombre: 'Taller: Aplicaciones de la Tecnología CRISPR',
            descripcion: 'Hands-on sobre las técnicas más modernas de edición de ADN.',
            tipo: 'Taller',
            fecha_inicio: new Date('2026-11-15'),
            fecha_fin: new Date('2027-03-31'),
            imagen: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=1600&q=85',
            requisitos: { base: { nombres: true, primer_apellido: true, email: true, celular: true, afiliacion: true, grado_academico: true }, custom: [{ label: 'Talla de Mandil', type: 'select', options: ['S', 'M', 'L', 'XL'] }] }
          }
        ]
      }
    ];

    // Datos públicos de muestra. Se completan también en cursos creados por una ejecución anterior del seeder.
    const presentaciones: Record<string, { objetivos: string; publico_objetivo: string }> = {
      'Simposio sobre Biología Molecular': { objetivos: 'Identificar avances recientes en biología molecular.\nRelacionar métodos de laboratorio con aplicaciones de investigación.\nDebatir resultados científicos con especialistas.', publico_objetivo: 'Estudiantes, investigadores y profesionales de ciencias biológicas y de la salud.' },
      'Taller de Redacción Científica': { objetivos: 'Estructurar un manuscrito científico.\nMejorar la claridad de resúmenes y resultados.\nReconocer criterios de selección de revistas académicas.', publico_objetivo: 'Estudiantes de posgrado, docentes e investigadores que preparan publicaciones.' },
      'Panel: Cambio Climático en los Andes': { objetivos: 'Reconocer impactos del cambio climático en la región andina.\nComparar propuestas de adaptación.\nParticipar en un diálogo informado con especialistas.', publico_objetivo: 'Estudiantes, investigadores, gestores públicos y público interesado en sostenibilidad.' },
      'Conferencia: IA en la educación': { objetivos: 'Identificar usos de inteligencia artificial en la enseñanza.\nReconocer oportunidades y límites de las herramientas actuales.', publico_objetivo: 'Docentes, estudiantes y responsables de innovación educativa.' },
      'Bootcamp de Programación Reactiva': { objetivos: 'Construir componentes interactivos.\nOrganizar el estado de una aplicación web.\nComparar prácticas de desarrollo en Vue y React.', publico_objetivo: 'Estudiantes y desarrolladores con conocimientos básicos de programación web.' },
      'Módulo I: Fundamentos de Python para Data Science': { objetivos: 'Preparar datos para su análisis.\nUsar estructuras y bibliotecas básicas de Python.\nCrear visualizaciones exploratorias.', publico_objetivo: 'Profesionales y estudiantes que inician su formación en ciencia de datos.' },
      'Módulo II: Deep Learning y Redes Neuronales': { objetivos: 'Explicar la estructura de una red neuronal.\nEntrenar y evaluar modelos básicos.\nInterpretar métricas y riesgos de sobreajuste.', publico_objetivo: 'Estudiantes y profesionales con conocimientos iniciales de Python y datos.' },
      'Seminario: El Potencial del Litio en la Región': { objetivos: 'Describir la cadena de valor del litio.\nComparar aplicaciones industriales y desafíos ambientales.\nAnalizar oportunidades regionales.', publico_objetivo: 'Estudiantes, investigadores y profesionales del sector energético.' },
      'Taller: Aplicaciones de la Tecnología CRISPR': { objetivos: 'Explicar fundamentos de edición genética.\nReconocer etapas de un experimento con CRISPR.\nAnalizar aplicaciones y consideraciones éticas.', publico_objetivo: 'Estudiantes avanzados e investigadores de biotecnología y ciencias de la vida.' },
    };

    const ponente = await userRepository.findOneBy({ email: 'ponente@gmail.com' });

    const coordinacionRepository = dataSource.getRepository(CoordinacionEvento);

    const coordinadores = await userRepository.find({
      where: { email: 'coordinador@gmail.com' }
    });
    const coordinador = coordinadores[0];

    for (const data of eventosData) {
      const { actividades, ...eventoInfo } = data;

      let evento = await eventoRepository.findOneBy({ nombre: eventoInfo.nombre });
      if (!evento) {
        evento = await eventoRepository.save(eventoRepository.create(eventoInfo));
        console.log(`Evento creado: ${evento.nombre}`);

        for (const act of actividades) {
          const requisitos = { ...act.requisitos, presentacion: presentaciones[act.nombre] };
          const nuevaActividad = await actividadRepository.save(actividadRepository.create({
            ...act,
            requisitos,
            evento: evento,
            horas: 40
          }));
          console.log(`  - Actividad añadida: ${nuevaActividad.nombre}`);
          
          if (ponente) {
            await imparticionRepository.save(imparticionRepository.create({
              actividadAcademica: nuevaActividad,
              usuario: ponente,
              evento: evento
            }));
            console.log(`    - Ponente asignado a la actividad ${nuevaActividad.nombre}`);
          }
          await this.asegurarHorario(dataSource, nuevaActividad.id, act.fecha_inicio, act.fecha_fin);
        }
      } else {
        console.log(`El evento "${evento.nombre}" ya existe. Se actualiza su vigencia.`);
        await eventoRepository.update(evento.id, {
          fecha_inicio: eventoInfo.fecha_inicio,
          fecha_fin: eventoInfo.fecha_fin,
          gestion: eventoInfo.gestion,
          estado: 1,
        });
        for (const act of actividades) {
          let existente = await actividadRepository.findOne({ where: { nombre: act.nombre, evento: { id: evento.id } } });
          if (!existente) {
            const requisitos = { ...act.requisitos, presentacion: presentaciones[act.nombre] };
            existente = await actividadRepository.save(actividadRepository.create({
              ...act,
              requisitos,
              evento: evento,
              horas: 40,
              estado: 1,
            }));
            if (ponente) {
              await imparticionRepository.save(imparticionRepository.create({
                actividadAcademica: existente,
                usuario: ponente,
                evento: evento
              }));
            }
          } else {
            existente.fecha_inicio = act.fecha_inicio;
            existente.fecha_fin = act.fecha_fin;
            existente.estado = 1;
            if (!existente.requisitos?.presentacion && presentaciones[act.nombre]) {
              existente.requisitos = { ...(existente.requisitos || {}), presentacion: presentaciones[act.nombre] };
            }
            await actividadRepository.save(existente);
          }
          await this.asegurarHorario(dataSource, existente.id, act.fecha_inicio, act.fecha_fin);
        }
      }

      if (coordinador && evento) {
        const coordExiste = await coordinacionRepository.findOneBy({
          usuario: { id: coordinador.id },
          evento: { id: evento.id }
        });
        if (!coordExiste) {
          await coordinacionRepository.save(coordinacionRepository.create({
            usuario: coordinador,
            evento: evento
          }));
          console.log(`    - Coordinador asignado a ${evento.nombre}`);
        }
      }
    }

    const hoy = new Date('2026-10-29T00:00:00.000Z');
    for (const data of eventosData) {
      for (const act of data.actividades) {
        const coincidencias = await actividadRepository.find({
          where: { nombre: act.nombre },
          relations: ['evento'],
        });
        for (const otra of coincidencias) {
          const fin = otra.fecha_fin ? new Date(otra.fecha_fin) : null;
          if (fin && fin >= hoy && fin >= new Date(act.fecha_fin)) continue;
          otra.fecha_inicio = act.fecha_inicio;
          otra.fecha_fin = act.fecha_fin;
          otra.estado = 1;
          await actividadRepository.save(otra);
          await this.asegurarHorario(dataSource, otra.id, act.fecha_inicio, act.fecha_fin);
          if (otra.evento?.id) {
            await eventoRepository.update(otra.evento.id, {
              fecha_inicio: data.fecha_inicio,
              fecha_fin: data.fecha_fin,
              estado: 1,
            });
          }
          console.log(`  - Vigencia ampliada: ${otra.nombre}`);
        }
      }
    }

    console.log('Seeder de Eventos y Actividades completado con éxito.');
  }
}
