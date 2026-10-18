import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';

const FIXED = new Date('2026-10-18T10:00:00Z');
const INK = '#14180f';
const MUTED = '#3c4634';
const LIME = '#4d6b00';

export const PACKAGES = [
  {
    name: 'Bronze',
    label: 'Presencia',
    price: 'Desde 4.500 €/trimestre',
    items: [
      'Tu logo en el pie de todas las páginas',
      'Mención en cada edición de la newsletter del trimestre',
      'Informe mensual: visitas y páginas vistas, con enlaces UTM hacia tu web',
    ],
  },
  {
    name: 'Silver',
    label: 'Visibilidad',
    price: 'Desde 12.000 €/trimestre',
    items: [
      'Todo lo de Bronze',
      'Espacio destacado en portada',
      'Una pieza de contenido patrocinado al mes, señalada como tal',
      'Tu marca en nuestra cobertura del próximo Grand Slam',
    ],
  },
  {
    name: 'Gold',
    label: 'Impacto',
    price: 'Desde 28.000 €/trimestre',
    items: [
      'Todo lo de Silver',
      'Una serie de tres piezas creada contigo',
      'Una sección con tu nombre (p. ej. «Guía de Grand Slams presentada por tu marca»)',
      'Una activación digital: sorteo, encuesta o contenido interactivo',
    ],
  },
  {
    name: 'Platinum',
    label: 'A medida',
    price: 'A medida',
    items: [
      'Acuerdo anual a tu medida',
      'Formatos e indicadores definidos contigo',
      'Interlocución directa con el fundador',
    ],
  },
];

const REPORT = 'Visitas y páginas vistas de las piezas acordadas, con país y procedencia (Cloudflare Web Analytics). Los clics hacia tu web, con enlaces UTM en tu propia analítica.';

const CSD = '91.557 licencias federadas de tenis y 117.508 de pádel en 2025. Fuente: Ministerio de Educación, Formación Profesional y Deportes / Consejo Superior de Deportes, Estadística de Deporte Federado 2025, tabla 1 (licencias por federación).';

function blocksFor(kind) {
  const packages = PACKAGES.map((plan) => `${plan.name} · ${plan.label} · ${plan.price}\n${plan.items.map((item) => `• ${item}`).join('\n')}`);
  const shared = [
    ['h1', kind === 'kit' ? 'Media kit' : 'Dossier de patrocinio'],
    ['kicker', 'Temporada 2026–2027'],
    ['lead', 'El tenis, contado con datos'],
    ['meta', 'acearena.io · sponsors@acearena.io · Octubre de 2026'],
    ['h2', 'Qué es AceArena'],
    ['p', 'AceArena es un medio digital de tenis profesional (ATP y WTA): noticias, resultados y rankings, con la fuente de cada dato. El proyecto se financia con patrocinio.'],
    ['p', 'Noticias del circuito, firmadas por la redacción, con el enlace a la fuente. Rankings ATP y WTA con la fecha de la lista. Guía de Grand Slams, calendario y glosario.'],
    ['p', 'Marcadores en juego, vía SportScore. Web: acearena.io. X: @AceArenaes. Instagram: @acearenaes. Newsletter: El resumen del lunes.'],
    ['h2', 'Paquetes de patrocinio'],
    ['p', 'Precios publicados. En Gold y Platinum, la primera marca de cada sector se queda la categoría. Propuesta en menos de 48 horas laborables.'],
    ...packages.map((text) => ['p', text]),
    ['h2', 'Informe'],
    ['p', REPORT],
    ['p', 'Cloudflare Web Analytics aporta visitas, páginas vistas, país, procedencia y dispositivo.'],
    ['h2', 'Cómo trabajamos'],
    ['p', '1. Brief. Objetivo, sector y un rango de presupuesto si ya existe.'],
    ['p', '2. Propuesta. En menos de 48 horas laborables, un texto con el paquete, el calendario y el informe, listo para reenviar.'],
    ['p', '3. Activación. Contenido y menciones según lo firmado. La relación con el cliente sigue siendo de la agencia.'],
    ['p', '4. Informe mensual, con el primer envío a los 30 días.'],
    ['h2', 'Contacto'],
    ['p', 'sponsors@acearena.io. Responde Angel Cebria Morales, fundador. El resto de mensajes: hola@acearena.io.'],
  ];
  if (kind === 'dossier') {
    shared.splice(8, 0,
      ['h2', 'El mercado en España'],
      ['p', 'El lector que encaja sigue el circuito, juega al tenis o al pádel, o trabaja en un club, una academia o una marca. Estas cifras son licencias federadas, no la audiencia de AceArena.'],
      ['p', CSD],
      ['h2', 'Dos citas para el trimestre'],
      ['p', 'Copa Davis Final 8, Bolonia (Italia), 24–29 de noviembre de 2026. España juega los cuartos ante Austria el 26 de noviembre. La final es el 29. Fuentes: daviscup.com/en/final-8-tickets y la ficha de España–Austria.'],
      ['p', 'Australian Open, Melbourne Park, 11–31 de enero de 2027. El cuadro principal se juega del 17 al 31 de enero. Fuente: ausopen.com, «Australian Open 2027 dates announced».'],
    );
  }
  return shared;
}

export function sponsorPlainText() {
  return ['kit', 'dossier'].map((kind) => blocksFor(kind).map(([, text]) => text).join('\n')).join('\n');
}

function render(blocks) {
  return new Promise((resolve) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: 'A4',
      margin: 52,
      compress: true,
      info: {
        Title: 'AceArena · Patrocinio',
        Author: 'AceArena',
        Creator: 'AceArena',
        Producer: 'AceArena',
        CreationDate: FIXED,
        ModDate: FIXED,
      },
    });
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    const width = doc.page.width - 104;
    const paintBar = () => {
      doc.save();
      doc.rect(0, 0, doc.page.width, 8).fill('#c6ff00');
      doc.restore();
      doc.y = 36;
    };
    paintBar();
    doc.on('pageAdded', paintBar);
    for (const [type, text] of blocks) {
      if (type === 'h1') {
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(26).text(text, { width });
        doc.moveDown(0.2);
      } else if (type === 'kicker') {
        doc.fillColor(LIME).font('Helvetica-Bold').fontSize(11).text(text, { width, characterSpacing: 0.4 });
        doc.moveDown(0.15);
      } else if (type === 'lead') {
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(16).text(text, { width });
        doc.moveDown(0.25);
      } else if (type === 'meta') {
        doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(text, { width });
        doc.moveDown(0.8);
      } else if (type === 'h2') {
        if (doc.y > 720) doc.addPage();
        doc.moveDown(0.45);
        doc.fillColor(LIME).font('Helvetica-Bold').fontSize(13).text(text, { width });
        doc.moveDown(0.25);
      } else {
        doc.fillColor(INK).font('Helvetica').fontSize(11).text(text, { width, lineGap: 2 });
        doc.moveDown(0.35);
      }
    }
    doc.end();
  });
}

export async function writeSponsorPdfs(publicDir) {
  const kit = await render(blocksFor('kit'));
  const dossier = await render(blocksFor('dossier'));
  writeFileSync(join(publicDir, 'media-kit-acearena.pdf'), kit);
  writeFileSync(join(publicDir, 'dossier', 'acearena-patrocinio.pdf'), dossier);
}
