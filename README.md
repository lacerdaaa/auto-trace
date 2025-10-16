# AutoTrace API

API de gestão e rastreio de manutenções veiculares com autenticação JWT, upload de arquivos, emissão/validação de certificados em PDF com QR Code e sugestões de manutenção preventiva baseadas em perfis por categoria.

- Stack: Node.js, TypeScript, Express 5, Prisma ORM (PostgreSQL), Zod, Multer, JSON Web Token, bcrypt, PDFKit, QRCode.
- Código de exemplo das rotas: veja `src/server.ts`, `src/routes/*`, `src/services/*`.

## Sumário

- [Requisitos](#requisitos)
- [Configuração](#configuração)
- [Instalação](#instalação)
- [Execução](#execução)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Autenticação](#autenticação)
- [Upload de arquivos](#upload-de-arquivos)
- [Sugestões de manutenção](#sugestões-de-manutenção)
- [Referência de API](#referência-de-api)
- [Erros e tratamento](#erros-e-tratamento)
- [Modelo de dados](#modelo-de-dados)
- [Notas importantes](#notas-importantes)

## Requisitos

- Node.js 18+ (recomendado LTS mais recente)
- PostgreSQL 13+ (ou compatível com Prisma)

## Configuração

Crie um arquivo `.env` na raiz com as variáveis abaixo (exemplo):

```
DATABASE_URL="postgresql://usuario:senha@localhost:5432/meubanco?schema=public"
PORT=3333
JWT_SECRET="sua-chave-secreta"
JWT_EXPIRES_IN="1d"        # Ex.: "1d", "12h", "3600" (segundos)
AVERAGE_MONTHLY_KM=1000     # Km/mês padrão quando aplicável
# UPLOAD_ROOT=./uploads     # Opcional; diretório base de uploads
```

Observação: a aplicação já tem valores padrão para `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `AVERAGE_MONTHLY_KM` e `UPLOAD_ROOT` caso não sejam definidos.

## Instalação

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
```

- `prisma:generate`: gera o cliente Prisma.
- `prisma:migrate`: aplica as migrações do schema no banco.

## Execução

- Desenvolvimento (TS + ts-node):

```bash
npm run start:dev
```

- Produção (build + Node):

```bash
npm run build
npm start
```

Health check: `GET /health` retorna `{ "status": "ok" }`.

## Estrutura de pastas

- `src/server.ts`: inicialização do Express, rotas e static de uploads.
- `src/routes/*`: rotas de autenticação, veículos, dashboard e certificados.
- `src/middlewares/*`: autenticação JWT e tratador de erros.
- `src/services/*`: geração de certificados (PDF+QR) e motor de sugestões.
- `src/schemas/*`: validações com Zod.
- `src/config.ts`: configurações da aplicação e perfis preventivos.
- `src/upload.ts`: configuração do Multer e diretórios de upload.
- `prisma/schema.prisma`: modelos e enums da base de dados.
- `uploads/`: raiz para arquivos salvos (fotos e documentos). Criada automaticamente.

## Autenticação

- JWT com esquema `Bearer <token>` no header `Authorization`.
- Registro e login expõem o token; rotas autenticadas usam `authenticate`.
- Hash de senhas com `bcrypt` (salt rounds 10).

Headers (exemplo):

```
Authorization: Bearer <seu-token-jwt>
Content-Type: application/json
```

## Upload de arquivos

- Implementado com Multer em disco.
- Diretórios:
  - Fotos de veículos: `uploads/vehicle-photos`
  - Documentos de manutenção: `uploads/maintenance-docs`
- Limites:
  - Foto: máx. 5 MB; aceita apenas `image/*`.
  - Documento: máx. 10 MB.
- Nomes de arquivos gerados com timestamp + hash para evitar colisões.
- Arquivos estáticos servidos em `GET /uploads/*`.

## Sugestões de manutenção

As sugestões consideram:

- Média de km/mês do veículo (`averageMonthlyKm`).
- Última manutenção registrada (odômetro e data) para estimar km atual.
- Perfil preventivo por categoria com checkpoints (km) e checklist.

Perfis (padrão em `src/config.ts`):

- `car`: 5k, 10k, 20k, 40k km
- `motorcycle`: 3k, 6k, 12k km
- `truck`: 10k, 20k, 40k km
- `other`: 5k, 15k km

Resultado inclui:

- `estimatedCurrentKm`, `monthlyAverageKm`
- `nextMaintenanceKm`, `kmToNext`, `overdue`, `estimatedDueDate`
- `checklist` do próximo checkpoint
- `upcoming` com todos os checkpoints e status de atraso

## Referência de API

Base URL padrão: `http://localhost:<PORT>`

### Autenticação

1) Registrar

- `POST /auth/register`
- Body:

```json
{
  "name": "Kauan ROmero",
  "email": "pedrin@example.com",
  "password": "minhasenha"
}
```

- Resposta 201:

```json
{
  "token": "<jwt>",
  "user": { "id": "...", "name": "Pedro Banin", "email": "romero@example.com", "role": "user", "createdAt": "..." }
}
```

2) Login

- `POST /auth/login`
- Body igual ao registro (email + password).
- Resposta 200 igual ao registro.

3) Usuário atual

- `GET /auth/me` (autenticado)
- Resposta 200: `{ "user": { ... } }`

### Veículos

1) Criar veículo

- `POST /vehicles` (autenticado)
- Body:

```json
{
  "plate": "ABC1D23",
  "model": "Onix",
  "manufacturer": "Chevrolet",
  "year": 2020,
  "category": "car",
  "averageMonthlyKm": 1200,
  "initialOdometer": 32000
}
```

Observações:
- `plate` é normalizada (remove espaços e vira maiúscula).
- `category` aceita atualmente: `car` | `motorcycle`.
- `initialOdometer` é o odômetro atual na data do cadastro (usado como base para sugestões quando ainda não há manutenções registradas).

- Resposta 201: `{ "vehicle": { ... } }`

2) Listar veículos do usuário

- `GET /vehicles` (autenticado)
- Resposta 200: `{ "vehicles": [ { ... } ] }`

3) Detalhe do veículo + manutenções + sugestões

- `GET /vehicles/:vehicleId` (autenticado)
- Resposta 200:

```json
{
  "vehicle": { ... },
  "maintenances": [ { ... } ],
  "suggestions": {
    "estimatedCurrentKm": 13500,
    "monthlyAverageKm": 1200,
    "nextMaintenanceKm": 20000,
    "kmToNext": 6500,
    "overdue": false,
    "estimatedDueDate": "2025-02-10T00:00:00.000Z",
    "checklist": ["Troca de filtros de ar e cabine", "Revisão do sistema de arrefecimento"],
    "upcoming": [ { "kmMark": 5000, "overdue": true, "checklist": ["..."] } ]
  }
}
```

4) Upload de foto do veículo

- `POST /vehicles/:vehicleId/photo` (autenticado)
- Content-Type: `multipart/form-data`
- Campo: `photo` (arquivo imagem)

Exemplo cURL:

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F photo=@/caminho/para/foto.jpg \
  http://localhost:3333/vehicles/<vehicleId>/photo
```

- Resposta 200: `{ "vehicle": { ... "photoUrl": "/uploads/vehicle-photos/<arquivo>" } }`

5) Registrar manutenção (com documento opcional)

- `POST /vehicles/:vehicleId/maintenance` (autenticado)
- Content-Type: `multipart/form-data`
- Campos:
  - `serviceType` (texto)
  - `serviceDate` (data; aceita string parseável, ex.: `2025-10-04`)
  - `odometer` (inteiro)
  - `workshop` (texto)
  - `notes` (opcional)
  - `document` (arquivo, opcional)

Exemplo cURL:

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F serviceType="Troca de óleo" \
  -F serviceDate=2025-10-04 \
  -F odometer=15000 \
  -F workshop="Oficina XPTO" \
  -F notes="Observações" \
  -F document=@/caminho/nota.pdf \
  http://localhost:3333/vehicles/<vehicleId>/maintenance
```

- Resposta 201: `{ "maintenance": { ... "documentUrl": "/uploads/maintenance-docs/<arquivo>" } }`

### Dashboard

- `GET /dashboard` (autenticado)
- Resposta 200:

```json
{
  "dashboard": [
    {
      "vehicleId": "...",
      "totalMaintenances": 3,
      "lastMaintenanceDate": "2025-10-01T12:00:00.000Z",
      "nextMaintenanceKm": 20000,
      "overdue": false
    }
  ]
}
```

### Certificados

1) Gerar certificado (PDF inline)

- `GET /certificates/:vehicleId` (autenticado)
- Resposta 200: `Content-Type: application/pdf`
- Header adicional: `X-Certificate-Id: <uuid>`
- Também registra um `Certificate` no banco, vinculado ao veículo/usuário.

Exemplo cURL (mostrando headers):

```bash
curl -i -H "Authorization: Bearer $TOKEN" \
  http://localhost:3333/certificates/<vehicleId> \
  -o autotrace-certificate.pdf
```

2) Validar certificado (público)

- `GET /certificates/validate/:certificateId`
- Resposta 200:

```json
{
  "certificate": {
    "id": "...",
    "vehicleId": "...",
    "vehiclePlate": "ABC1D23",
    "generatedAt": "2025-10-04T17:00:00.000Z",
    "maintenanceCount": 3,
    "lastMaintenanceDate": "2025-09-15T00:00:00.000Z",
    "overdue": false
  }
}
```

### Health e arquivos estáticos

- `GET /health` → `{ "status": "ok" }`.
- `GET /uploads/*` → serve arquivos enviados (fotos e documentos).

## Erros e tratamento

- Validações com Zod retornam 400 com detalhes (campos e mensagens).
- Autorização/Autenticação incorretas retornam 401 ou 403.
- Conflitos (duplicidade) retornam 409.
- Erros Prisma retornam 400/409 com metadados úteis.
- Upload inválido retorna 400 (erros Multer).
- Erros não tratados retornam 500.

Formato de erro (exemplo):

```json
{
  "error": "Validação falhou",
  "details": { ... }
}
```

## Modelo de dados

Entidades principais (veja `prisma/schema.prisma`):

- `User` (id, name, email, passwordHash, role, createdAt, updatedAt)
- `Vehicle` (id, userId, plate, model, manufacturer, year, category, averageMonthlyKm, photoFileName, createdAt, updatedAt)
- `MaintenanceRecord` (id, vehicleId, userId, serviceType, serviceDate, odometer, workshop, notes, documentFileName, createdAt, updatedAt)
- `Certificate` (id, vehicleId, userId, vehiclePlate, generatedAt, maintenanceCount, lastMaintenanceDate, overdue)

Enums:

- `UserRole`: `user` | `admin`
- `VehicleCategory`: `car` | `motorcycle` | `truck` | `other`

## Notas importantes

- Placas são normalizadas (sem espaços e em maiúsculas) e únicas por sistema.
- E-mails são salvos em minúsculas e são únicos.
- Datas são retornadas como ISO string.
- Diretórios de upload são criados automaticamente no startup do módulo de upload.
- Algumas categorias extras (`truck`, `other`) existem nos perfis preventivos, mas o endpoint de criação de veículo atualmente aceita apenas `car` e `motorcycle`.
- Para alterar perfis/checklists, edite `src/config.ts` (`PREVENTIVE_PROFILES`).

---

## Guia para Iniciantes (Passo a passo)

Este guia mostra, na prática, o fluxo completo usando cURL. Você pode fazer o mesmo no Insomnia/Postman.

1) Suba o banco e aplique migrações

- Configure o `.env` (use o `.env.example` como base) e rode:

```bash
npm run prisma:generate && npm run prisma:migrate
```

2) Inicie a API em modo desenvolvimento

```bash
npm run start:dev
```

3) Defina variáveis auxiliares no terminal

```bash
export BASE_URL=http://localhost:3333
```

4) Registre um usuário e capture o token

```bash
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pedro Silva",
    "email": kauanzin@example.com",
    "password": "minhasenha"
  }'
```

Copie o valor do campo `token` da resposta. Opcionalmente, salve-o em uma variável:

```bash
export TOKEN="<cole_o_token_aqui>"
```

Se o e-mail já existir, use `/auth/login` para obter o token:

```bashf
curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{ "email": kauanzin@example.com", "password": "minhasenha" }'
```

5) Crie um veículo e guarde o `vehicle.id`

```bash
curl -s -X POST "$BASE_URL/vehicles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plate": "ABC1D23",
    "model": "Onix",
    "manufacturer": "Fiesta",
    "year": 2014,
    "category": "car",
    "averageMonthlyKm": 1200,
    "initialOdometer": 203103032
  }'
```

Anote o `vehicle.id` retornado (é um UUID). Você também pode listar os seus veículos:

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/vehicles"
```

6) (Opcional) Envie uma foto do veículo

```bash
curl -s -X POST "$BASE_URL/vehicles/<vehicleId>/photo" \
  -H "Authorization: Bearer $TOKEN" \
  -F photo=@/caminho/para/foto.jpg
```

7) Registre uma manutenção (com documento opcional)

```bash
curl -s -X POST "$BASE_URL/vehicles/<vehicleId>/maintenance" \
  -H "Authorization: Bearer $TOKEN" \
  -F serviceType="Troca de óleo" \
  -F serviceDate=2025-10-04 \
  -F odometer=15000 \
  -F workshop="Oficina XPTO" \
  -F notes="Observações" \
  -F document=@/caminho/nota.pdf
```

8) Consulte detalhes + sugestões do veículo

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/vehicles/<vehicleId>"
```

9) Veja o dashboard resumido

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/dashboard"
```

10) Gere o certificado em PDF e valide-o

```bash
# gera o PDF (resposta binária). O header X-Certificate-Id vem na resposta
curl -i -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/certificates/<vehicleId>" \
  -o autotrace-certificate.pdf

# com o id do header, valide publicamente
curl -s "$BASE_URL/certificates/validate/<certificateId>"
```

Pronto! Você percorreu o fluxo completo.

## Rotas e Payloads (explicado para iniciantes)

Campos comuns:
- IDs são UUID (ex.: `d290f1ee-6c54-4b01-90e6-d701748f0851`).
- Datas são strings ISO (ex.: `2025-10-04T00:00:00.000Z`) ou valores parseáveis por Date quando enviado em `multipart/form-data`.

1) Autenticação

- Registrar: `POST /auth/register`
  - Body: `name` (min 3), `email` (válido), `password` (min 6)
  - Retorna: `token` e `user`

- Login: `POST /auth/login`
  - Body: `email`, `password`
  - Retorna: `token` e `user`

- Eu: `GET /auth/me` (precisa header `Authorization: Bearer <token>`)
  - Retorna: `user`

2) Veículos

- Criar: `POST /vehicles`
  - Body:
    - `plate` (ex.: `ABC1D23`) → o sistema remove espaços e põe em maiúsculas
    - `model` (min 2), `manufacturer` (min 2)
    - `year` (>=1950 e <= ano atual + 1)
    - `category`: `car` | `motorcycle`
    - `averageMonthlyKm`: número positivo
    - `initialOdometer`: inteiro >= 0 (odômetro no momento do cadastro)
  - Erros comuns: 409 se placa duplicada; 400 se validação falhar

- Listar meus veículos: `GET /vehicles`

- Detalhe + sugestões: `GET /vehicles/:vehicleId`
  - Inclui `maintenances` e resumo `suggestions`

- Foto do veículo: `POST /vehicles/:vehicleId/photo`
  - `multipart/form-data`, campo `photo` (image/*, até 5 MB)
  - Retorna `photoUrl` acessível em `/uploads/vehicle-photos/<arquivo>`

- Registrar manutenção: `POST /vehicles/:vehicleId/maintenance`
  - `multipart/form-data` com:
    - `serviceType` (min 2), `serviceDate`, `odometer` (inteiro >= 0)
    - `workshop` (min 2), `notes` (opcional)
    - `document` (opcional, até 10 MB)

3) Dashboard

- `GET /dashboard` → resumo por veículo com `nextMaintenanceKm` e `overdue`

4) Certificados

- Gerar PDF: `GET /certificates/:vehicleId` (autenticado)
  - Resposta: PDF; header `X-Certificate-Id` com o id do certificado
  - Também registra o certificado no banco

- Validar: `GET /certificates/validate/:certificateId` (público)

## Exemplos no Insomnia/Postman

- Crie um ambiente com `BASE_URL` (ex.: `http://localhost:3333`).
- Faça a requisição `POST /auth/register` ou `POST /auth/login`.
- Salve o `token` retornado como variável do ambiente.
- Nas rotas autenticadas, configure o header `Authorization` com `Bearer {{ token }}`.
- Para `multipart/form-data`, use a aba de arquivos (file picker) e os campos de texto conforme descrito acima.

## Dicas e Solução de Problemas

- Variável incorreta no .env: use `JWT_SECRET` (e não `JWT-SECRET`).
- Portas: a API usa `PORT` (padrão 3333). Ajuste `BASE_URL` nos seus clientes.
- Build vs dev: o comando `npm run start:dev` é o caminho mais simples para testar. Para build, garanta que seu `tsconfig.json` permita emitir arquivos (a flag `noEmit` deve estar desativada) antes de usar `npm run build && npm start`.
- Uploads: verifique se o arquivo não ultrapassa os limites e, no caso de foto, se o `mimetype` começa com `image/`.
- Erros de validação (400): a resposta inclui detalhes por campo (Zod), útil para corrigir o payload.

---

Dúvidas ou melhorias? Abra uma issue ou ajuste diretamente os arquivos de rota/serviço conforme necessário.
