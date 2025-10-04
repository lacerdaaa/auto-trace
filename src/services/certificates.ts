import { randomUUID } from 'node:crypto';
import { Readable } from 'stream';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { CERTIFICATE_TEMPLATE_META } from '../config.js';
import type { SuggestionSummary } from '../types.js';

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
}

interface CertificateResult {
  certificateId: string;
  buffer: Buffer;
}

const formatLine = (label: string, value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') {
    return `${label}: -`;
  }
  return `${label}: ${value}`;
};

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

  doc.fontSize(22).text(CERTIFICATE_TEMPLATE_META.title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`ID do Certificado: ${certificateId}`);
  doc.text(`Emitido por: ${CERTIFICATE_TEMPLATE_META.issuer}`);
  doc.text(`Data de Emissão: ${new Date().toLocaleString('pt-BR')}`);
  doc.moveDown();

  doc.fontSize(16).text('Dados do Veículo');
  doc.fontSize(12);
  doc.text(formatLine('Proprietário', ownerName));
  doc.text(formatLine('Placa', vehicle.plate));
  doc.text(formatLine('Modelo', vehicle.model));
  doc.text(formatLine('Fabricante', vehicle.manufacturer));
  doc.text(formatLine('Ano', vehicle.year));
  doc.text(formatLine('Categoria', vehicle.category));
  doc.text(formatLine('Média Km/mês', `${vehicle.averageMonthlyKm} km`));
  doc.moveDown();

  doc.fontSize(16).text('Histórico de Manutenções');
  doc.fontSize(11);
  if (maintenances.length === 0) {
    doc.text('Nenhuma manutenção registrada.');
  } else {
    maintenances.forEach((maintenance) => {
      doc.text(maintenanceLine(maintenance));
    });
  }
  doc.moveDown();

  doc.fontSize(16).text('Próximas Recomendações');
  doc.fontSize(12);
  doc.text(formatLine('Próxima manutenção em', `${suggestions.nextMaintenanceKm} km`));
  doc.text(formatLine('Km restante', `${suggestions.kmToNext} km`));
  doc.text(`Situação: ${suggestions.overdue ? 'Pendente / Atrasada' : 'Em dia'}`);
  if (suggestions.estimatedDueDate) {
    doc.text(`Prazo estimado: ${new Date(suggestions.estimatedDueDate).toLocaleDateString('pt-BR')}`);
  }
  doc.moveDown();

  doc.fontSize(14).text('Checklist Diferenciado');
  doc.fontSize(11);
  suggestions.checklist.forEach((item) => doc.text(`• ${item}`));
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
