import type { Route } from "./+types/folha";
import { FechamentoFolha } from "~/components/folha/fechamento-folha";
import {
	hojeFechamento,
	limitesDoPeriodo,
	mesAtualFechamento,
	montarFechamento,
	parseMesFechamento,
	parseTipoLancamento,
} from "~/lib/folha";
import {
	atualizarFuncionario,
	criarFuncionario,
	excluirFuncionario,
	getFuncionarios,
	removerLancamento,
	salvarLancamentos,
	sincronizarDespesasFolha,
} from "~/models/folha.server";

export function meta({}: Route.MetaArgs) {
	return [{ title: "Folha" }, { name: "description", content: "Folha de pagamento" }];
}

export async function loader({ request }: Route.LoaderArgs) {
	// Lança/atualiza em Despesas o total de salários e de 13º pagos nos meses recentes.
	await sincronizarDespesasFolha();
	const url = new URL(request.url);
	const mesAtual = mesAtualFechamento();
	const periodo = parseMesFechamento(url.searchParams.get("mes")) ?? mesAtual;
	const tipo = parseTipoLancamento(url.searchParams.get("tipo")) ?? "salario";
	const funcionarios = await getFuncionarios();
	return {
		fechamento: montarFechamento(funcionarios, tipo, periodo),
		mesAtual,
		hoje: hojeFechamento(),
	};
}

function texto(formData: FormData, campo: string): string {
	const v = formData.get(campo);
	return typeof v === "string" ? v.trim() : "";
}

function lerPeriodoETipo(formData: FormData) {
	const periodo = parseMesFechamento(texto(formData, "mes"));
	const tipo = parseTipoLancamento(formData.get("tipo"));
	return periodo && tipo ? { periodo, tipo } : null;
}

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "novoFuncionario" || intent === "editarFuncionario") {
		const nome = texto(formData, "nome");
		const conta = texto(formData, "conta");
		if (!nome || !conta) return { error: "Preencha nome e conta/PIX" };
		try {
			if (intent === "novoFuncionario") await criarFuncionario(nome, conta);
			else await atualizarFuncionario(texto(formData, "folhaId"), nome, conta);
			return { success: true };
		} catch {
			return { error: "Não foi possível salvar o funcionário" };
		}
	}

	if (intent === "excluirFuncionario") {
		try {
			await excluirFuncionario(texto(formData, "folhaId"));
			return { success: true };
		} catch (err) {
			return {
				error: err instanceof Error ? err.message : "Erro ao excluir funcionário",
			};
		}
	}

	if (intent === "salvarLancamentos") {
		const alvo = lerPeriodoETipo(formData);
		if (!alvo) return { error: "Mês ou tipo de lançamento inválido" };

		const dataStr = texto(formData, "data");
		const { dataMin, dataMax } = limitesDoPeriodo(alvo.tipo, alvo.periodo);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr) || dataStr < dataMin || dataStr > dataMax) {
			const br = (d: string) => d.split("-").reverse().join("/");
			return { error: `A data precisa estar entre ${br(dataMin)} e ${br(dataMax)}.` };
		}

		let itens: { folhaId: string; valor: number }[];
		try {
			const bruto: unknown = JSON.parse(texto(formData, "itens") || "[]");
			if (!Array.isArray(bruto)) throw new Error();
			itens = bruto.map((i) => {
				const valor = Number(i?.valor);
				if (typeof i?.folhaId !== "string" || !(valor > 0)) throw new Error();
				return { folhaId: i.folhaId, valor: Math.round(valor * 100) / 100 };
			});
		} catch {
			return { error: "Valores inválidos" };
		}
		if (itens.length === 0) return { error: "Selecione ao menos uma pessoa" };

		try {
			await salvarLancamentos(
				alvo.tipo,
				alvo.periodo,
				new Date(`${dataStr}T00:00:00.000Z`),
				formData.get("pago") === "1",
				itens,
			);
			return { success: true };
		} catch {
			return { error: "Erro ao salvar os lançamentos" };
		}
	}

	if (intent === "removerLancamento") {
		const alvo = lerPeriodoETipo(formData);
		const folhaId = texto(formData, "folhaId");
		if (!alvo || !folhaId) return { error: "Lançamento inválido" };
		try {
			await removerLancamento(folhaId, alvo.tipo, alvo.periodo);
			return { success: true };
		} catch (err) {
			return {
				error: err instanceof Error ? err.message : "Erro ao remover lançamento",
			};
		}
	}

	return { error: "Ação desconhecida" };
}

export default function Folha({ loaderData }: Route.ComponentProps) {
	const { fechamento, mesAtual, hoje } = loaderData;
	return (
		<div className='container mx-auto space-y-4'>
			<h1 className='text-2xl font-bold'>Folha</h1>
			<FechamentoFolha fechamento={fechamento} mesAtual={mesAtual} hoje={hoje} />
		</div>
	);
}
