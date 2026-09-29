# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server at http://localhost:5173 (HMR)
npm run build        # Production build (output: build/client + build/server)
npm run start        # Serve production build on port 3000
npm run typecheck    # react-router typegen && tsc (run after adding routes)
```

After adding or modifying routes in `app/routes.ts`, run `npm run typecheck` to regenerate `+types/` in `.react-router/`.

Docker builds in 4 stages (`node:20-alpine`). The final image runs `npm run start` on port 3000. Prisma `generate` runs inside the Docker build; you do not need to do it locally unless you change `schema.prisma`.

## Architecture

**Stack:** React Router v7 (SSR) · Prisma 6 · MongoDB · TailwindCSS v4 · shadcn/ui · Recharts · PocketBase (file uploads)

### Layer structure

| Layer | Location | Rule |
|---|---|---|
| Database client | `app/db.server.ts` | Singleton `PrismaClient`. Import as `import { db } from "~/db.server"`. Never instantiate directly. |
| Data access | `app/models/*.server.ts` | All Prisma queries live here. Server-only (`.server.ts` = excluded from client bundle). |
| Routes | `app/routes/*.tsx` | Export `loader` (GET), `action` (mutations), and a default React component. Route tree is in `app/routes.ts`. |
| Shared utilities | `app/lib/` | Date helpers (`mes-ano.ts`), formatters. |
| Business logic | `app/utils/financeiro.ts` | `calcularSaudeFinanceira` — the single source of truth for financial KPIs. |
| Context | `app/context/mes-ano-context.tsx` | `MesAnoContext` propagates the selected month/year across the layout without prop drilling. |
| Components | `app/components/` | UI components; `app/components/ui/` holds shadcn primitives. |

The root layout (`app/routes/_layout.tsx`) wraps every page in `<MesAnoProvider>` and `<SidebarProvider>`.

### Database schema (MongoDB via Prisma)

| Model | Purpose |
|---|---|
| `despesas` | Expenses: `tipo` = `"fixo"` or `"variavel"`, `conta` = category, `pago` flag |
| `receitas` | Revenues |
| `compras` | Purchases (NF/invoices): `nf` is a JSON blob |
| `estoque` | Monthly stock snapshots (used for CMV) |
| `fornecedores` | Supplier names — shared with the ERP, so `nome` is `@map("razaoSocial")` |
| `produtos_preco` | Product price catalogue — fed by the ERP: `codigo` is an `Int` and `unidade` is `@map("unid")` |

The database now lives on the self-hosted instance (`easypanel.quattoracademia.com`), shared with the Quattor ERP, which owns `fornecedores` and `produtos_preco` and writes them in its own shape — hence the `@map`s above. The ERP also owns ~25 other collections in the same database (`vendas`, `notas_fiscais_*`, `produtos`, `ncms`, …) that this app must not touch.

### Contas corrente — removed

The bank-account feature (auto-posting extrato entries, `saldo` tracking, the home balance cards and the `contaCorrente` field on despesas/receitas) was **removed from the code**. The MongoDB collections `contas_corrente` and `conta_corrente_saldo_mensal` and the `contaCorrente` field on existing documents were deliberately left untouched in the database, but nothing reads or writes them. Do not reintroduce them without being asked.

### Date handling — critical

All dates are stored as **UTC midnight** (from `<input type="date">` → e.g. `2026-04-01T00:00:00.000Z`). Always use `getUTC*` accessors, never local-time ones. Use the helpers in `~/lib/mes-ano.ts`:

- `obterMesAnoDaDataCivilUTC(data)` — extract month/year from a UTC-midnight date
- `isMesmoMesAnoDataCivilUTC(data, mes, ano)` — compare month/year
- `obterMesAnoAtual()` — current month/year in `America/Sao_Paulo`

### Financial KPIs (home dashboard)

All logic is in `app/utils/financeiro.ts → calcularSaudeFinanceira`. Mercadoria is counted **once** per metric, never twice: despesas with `conta === "Revenda"` are the paid merchandise, and are excluded from the "variáveis" sum. See `docs/metricas-home.md` for full explanation of every metric.

- **Lucro líquido** (cash view) = Receitas − Revenda paga − Variáveis (excl. Revenda) − Fixas
- **Lucro real** = Receitas − CMV − Variáveis (excl. Revenda) − Fixas, with **CMV = estoque inicial + Compras NF − estoque final**. CMV must use Compras NF (stock is valued at invoice cost), never Revenda.
- **Estoque**: the `estoque` record dated day 1 of a month (`local: "todas"`) is that month's **opening** stock; the closing stock is the next month's day-1 record. While it doesn't exist, lucro real is `null` ("aguardando").
- **Ponto de equilíbrio** = Fixas / margem %, using the **CMV** margin; falls back to the cash margin only when CMV is unavailable (`baseEquilibrio`). `status` follows the same rule (lucro real, else lucro líquido).

### File uploads

PocketBase handles file storage for expense receipts (`comprovante`) and boletos. Upload logic is in `app/models/pocketbase.server.ts`. The URL is stored as a string on the `despesas` record.

### Business domain vocabulary

All code uses Portuguese names: `despesas` (expenses), `receitas` (revenues), `compras` (purchases), `fornecedores` (suppliers), `contas corrente` (bank accounts), `extrato` (bank statement entry), `loja` (store branch: QI/QNE/NRT/SDS), `pago` (paid flag).
