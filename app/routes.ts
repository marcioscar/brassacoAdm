import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/_layout.tsx", [
    index("routes/home.tsx"),
   route("despesas", "routes/despesas.tsx"),
   route("despesas/comprovante/:id", "routes/despesas.comprovante.$id.tsx"),
   route("despesas/boleto/:id", "routes/despesas.boleto.$id.tsx"),
   route("contas_a_pagar", "routes/contas_a_pagar.tsx"),
   route("compras", "routes/compras.tsx"),
   route("receitas", "routes/receitas.tsx"),
  ]),
] satisfies RouteConfig;
