import { z } from "zod";

export const CONTAS_CORRENTES = [
	"Inter - BEL",
	"Inter-PEL",
	"Inter-SEL",
	"Bradesco-BEL",
	"Bradesco-PEL",
	"Bradesco-SEL",
] as const;

export const contaCorrenteSchema = z.enum(CONTAS_CORRENTES, {
	errorMap: () => ({ message: "Conta corrente é obrigatória" }),
});
