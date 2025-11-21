import { randomUUID } from 'node:crypto';
import { Readable } from 'stream';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { CERTIFICATE_TEMPLATE_META } from '../config.ts';
import type { SuggestionSummary } from '../types.ts';

interface CertificateVehicle {
  id: string;
  plate: string;
  model: string;
  manufacturer: string;
  year: number;
  category: string;
  averageMonthlyKm: number;
}

interface CertificateMaintenanceRecord {
  id: string;
  serviceType: string;
  serviceDate: Date;
  odometer: number;
  workshop: string;
}

interface CertificateContext {
  vehicle: CertificateVehicle;
  ownerName: string;
  maintenances: CertificateMaintenanceRecord[];
  suggestions: SuggestionSummary;
  vehiclePhotos?: Buffer[];
}

interface CertificateResult {
  certificateId: string;
  buffer: Buffer;
}

const maintenanceLine = (maintenance: CertificateMaintenanceRecord): string => {
  const date = maintenance.serviceDate.toISOString().split('T')[0];
  return `${date} | ${maintenance.serviceType} | ${maintenance.odometer} km | ${maintenance.workshop}`;
};

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    stream
      .on('data', (chunk) => chunks.push(chunk as Buffer))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);
  });
};

export const generateCertificate = async ({
  vehicle,
  ownerName,
  maintenances,
  suggestions,
  vehiclePhotos = [],
}: CertificateContext): Promise<CertificateResult> => {
  const certificateId = randomUUID();
  const qrPayload = {
    certificateId,
    vehicleId: vehicle.id,
    plate: vehicle.plate,
    generatedAt: new Date().toISOString(),
  };
  const dataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload));
  const base64 = dataUrl.split(',')[1] ?? '';
  const qrBuffer = Buffer.from(base64, 'base64');

  const doc = new PDFDocument({ margin: 50 });
  doc.info.Title = CERTIFICATE_TEMPLATE_META.title;
  doc.info.Author = CERTIFICATE_TEMPLATE_META.issuer;

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colors = {
    primary: '#1F2937',
    accent: '#0EA5E9',
    text: '#111827',
    subtle: '#6B7280',
    border: '#E5E7EB',
  } as const;

  const drawSectionHeader = (title: string) => {
    doc.moveDown(0.5);
    doc.fillColor(colors.primary).fontSize(16).text(title);
    doc.strokeColor(colors.accent).lineWidth(1)
      .moveTo(doc.page.margins.left, doc.y + 2)
      .lineTo(doc.page.margins.left + pageWidth, doc.y + 2)
      .stroke();
    doc.moveDown(0.4);
    doc.fillColor(colors.text).fontSize(11);
  };

  const drawInfoRow = (label: string, value: string | number | null) => {
    doc.fontSize(11)
      .fillColor(colors.subtle)
      .text(label, { continued: true })
      .fillColor(colors.text)
      .text(` ${value ?? '-'}`);
  };

  const drawPhotoGrid = (buffers: Buffer[]) => {
    if (!buffers.length) {
      doc.fontSize(11).fillColor(colors.subtle).text('Nenhuma foto adicionada.');
      return;
    }

    const columns = 3;
    const size = 130;
    const gap = 12;
    let col = 0;
    let x = doc.page.margins.left;
    let y = doc.y;

    buffers.forEach((buffer, index) => {
      if (y + size > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.y;
        x = doc.page.margins.left;
        col = 0;
      }

      doc.rect(x - 2, y - 2, size + 4, size + 4).stroke(colors.border);
      doc.image(buffer, x, y, {
        fit: [size, size],
        align: 'center',
        valign: 'center',
      });

      col += 1;
      x += size + gap;
      if (col === columns) {
        col = 0;
        x = doc.page.margins.left;
        y += size + gap;
      }

      if (index === buffers.length - 1) {
        doc.y = y + (col === 0 ? 0 : size + gap);
      }
    });

    doc.moveDown();
  };

  const headerHeight = 70;
  doc.rect(doc.page.margins.left - 10, doc.y, pageWidth + 20, headerHeight).fill(colors.primary);
  doc.save();
  doc.fillColor('#FFFFFF');
  doc.translate(0, 10);
  doc.fontSize(22).text(CERTIFICATE_TEMPLATE_META.title, {
    align: 'center',
    continued: false,
  });
  doc.moveDown(0.2);
  doc.fontSize(12).text(`ID do Certificado: ${certificateId}`, { align: 'center' });
  doc.text(`Emitido por: ${CERTIFICATE_TEMPLATE_META.issuer}`, { align: 'center' });
  doc.text(`Data de Emissão: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
  doc.restore();
  doc.moveDown(1.5);

  drawSectionHeader('Dados do Veículo');
  drawInfoRow('Proprietário:', ownerName);
  drawInfoRow('Placa:', vehicle.plate);
  drawInfoRow('Modelo:', vehicle.model);
  drawInfoRow('Fabricante:', vehicle.manufacturer);
  drawInfoRow('Ano:', vehicle.year);
  drawInfoRow('Categoria:', vehicle.category);
  drawInfoRow('Média Km/mês:', `${vehicle.averageMonthlyKm} km`);

  drawSectionHeader('Galeria do Veículo');
  drawPhotoGrid(vehiclePhotos);

  drawSectionHeader('Histórico de Manutenções');
  if (maintenances.length === 0) {
    doc.fontSize(11).fillColor(colors.subtle).text('Nenhuma manutenção registrada.');
  } else {
    maintenances.forEach((maintenance) => {
      doc.fontSize(11).fillColor(colors.text).text(maintenanceLine(maintenance));
    });
  }
  doc.moveDown();

  drawSectionHeader('Próximas Recomendações');
  drawInfoRow('Próxima manutenção em:', `${suggestions.nextMaintenanceKm} km`);
  drawInfoRow('Km restante:', `${suggestions.kmToNext} km`);
  drawInfoRow('Situação:', suggestions.overdue ? 'Pendente / Atrasada' : 'Em dia');
  if (suggestions.estimatedDueDate) {
    drawInfoRow('Prazo estimado:', new Date(suggestions.estimatedDueDate).toLocaleDateString('pt-BR'));
  }
  doc.moveDown();

  drawSectionHeader('Checklist Diferenciado');
  if (suggestions.checklist.length === 0) {
    doc.fontSize(11).fillColor(colors.subtle).text('Nenhum item sugerido.');
  } else {
    suggestions.checklist.forEach((item) => {
      doc.fontSize(11).fillColor(colors.text).text(`• ${item}`);
    });
  }
  doc.moveDown();

  doc.image(qrBuffer, {
    fit: [140, 140],
    align: 'center',
    valign: 'center',
  });
  doc.moveDown();
  doc.fontSize(10).text('Escaneie o QR Code para validar o certificado.', { align: 'center' });

  doc.end();

  const buffer = await streamToBuffer(doc as unknown as Readable);
  return { certificateId, buffer };
};
