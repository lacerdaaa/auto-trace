export const APP_PORT = Number.parseInt(process.env.PORT ?? '3333', 10);
export const JWT_SECRET = process.env.JWT_SECRET ?? 'local-dev-secret';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1d';
export const AVERAGE_MONTHLY_KM = Number.parseInt(process.env.AVERAGE_MONTHLY_KM ?? '1000', 10);

export const CERTIFICATE_TEMPLATE_META = {
  issuer: 'AutoTrace',
  title: 'Certificado Digital AutoTrace',
};

export const PREVENTIVE_PROFILES = {
  car: [
    { kmMark: 5000, items: ['Troca de óleo e filtro', 'Verificação de fluídos'] },
    { kmMark: 10000, items: ['Alinhamento e balanceamento', 'Inspeção de freios'] },
    { kmMark: 20000, items: ['Troca de filtros de ar e cabine', 'Revisão do sistema de arrefecimento'] },
    { kmMark: 40000, items: ['Inspeção da correia dentada', 'Troca de velas'] },
  ],
  motorcycle: [
    { kmMark: 3000, items: ['Troca de óleo', 'Ajuste de corrente'] },
    { kmMark: 6000, items: ['Verificação de freios', 'Lubrificação de cabos'] },
    { kmMark: 12000, items: ['Revisão de suspensão', 'Troca de filtro de ar'] },
  ],
  truck: [
    { kmMark: 10000, items: ['Troca de óleo de motor e filtros', 'Verificação de sistema pneumático'] },
    { kmMark: 20000, items: ['Inspeção de suspensão e direção', 'Revisão de freios'] },
    { kmMark: 40000, items: ['Troca de fluído de transmissão', 'Verificação de diferencial'] },
  ],
  other: [
    { kmMark: 5000, items: ['Checagem geral de fluídos', 'Aperto de componentes'] },
    { kmMark: 15000, items: ['Revisão estrutural', 'Verificação elétrica'] },
  ],
} as const;

export type PreventiveProfileKey = keyof typeof PREVENTIVE_PROFILES;
