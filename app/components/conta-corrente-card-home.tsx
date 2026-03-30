import { useMemo } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { formatCurrencyBRL } from "~/lib/formatters";

type ExtratoLinha = {
	data: Date | string;
	descricao: string;
	valor: number;
};

type ContaLoader = {
	saldo: number | null;
	extratos: ExtratoLinha[] | null;
} | null;

const DIAS_EXTRATO_VISIVEL = 60;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

function extratoDentroDosUltimosDias(
	linha: ExtratoLinha,
	dias: number,
	agora: number,
) {
	const t = new Date(linha.data).getTime();
	return t >= agora - dias * MS_POR_DIA;
}

function filtrarExtratosUltimosDias(extratos: ExtratoLinha[], dias: number) {
	const agora = Date.now();
	return extratos.filter((e) => extratoDentroDosUltimosDias(e, dias, agora));
}

function ordenarExtratosDesc(extratos: ExtratoLinha[]) {
	return [...extratos].sort(
		(a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
	);
}

/** Cor pelo sufixo da loja (BEL / PEL / SEL), independente do banco. */
function classNameTituloConta(nome: string) {
	const fim = nome
		.replace(/\s+/g, "")
		.match(/(BEL|PEL|SEL)$/i)?.[1]
		?.toUpperCase();
	switch (fim) {
		case "BEL":
			return "text-indigo-600 dark:text-indigo-400";
		case "PEL":
			return "text-amber-600 dark:text-amber-400";
		case "SEL":
			return "text-emerald-600 dark:text-emerald-400";
		default:
			return "text-muted-foreground";
	}
}

export function ContaCorrenteCardHome({
	nome,
	conta,
}: {
	nome: string;
	conta: ContaLoader;
}) {
	const { extratosOrdenados, semLancamentosNoPeriodo } = useMemo(() => {
		const bruto = conta?.extratos;
		if (!bruto?.length) {
			return { extratosOrdenados: [], semLancamentosNoPeriodo: false };
		}
		const filtrados = filtrarExtratosUltimosDias(
			bruto,
			DIAS_EXTRATO_VISIVEL,
		);
		const ordenados = ordenarExtratosDesc(filtrados);
		return {
			extratosOrdenados: ordenados,
			semLancamentosNoPeriodo: ordenados.length === 0,
		};
	}, [conta?.extratos]);

	return (
		<Card className='@container/card'>
			<Collapsible defaultOpen={false} className='group'>
				<CardHeader className='pb-2'>
					<CardDescription className={classNameTituloConta(nome)}>
						{nome}
					</CardDescription>
					<CollapsibleTrigger asChild>
						<button
							type='button'
							className='flex w-full items-center justify-between gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring'>
							<CardTitle className='text-2xl tabular-nums @[250px]/card:text-xl font-light font-mono'>
								{conta != null ? formatCurrencyBRL(conta.saldo ?? 0) : "—"}
							</CardTitle>
							<ChevronDown className='text-muted-foreground size-5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180' />
						</button>
					</CollapsibleTrigger>
				</CardHeader>
				<CollapsibleContent>
					<CardContent className='pt-0'>
						{conta == null ? (
							<p className='text-muted-foreground text-sm'>
								Cadastre a conta &quot;{nome}&quot; em{" "}
								<code className='text-xs'>contas_corrente</code> para ver o
								saldo e o extrato.
							</p>
						) : extratosOrdenados.length === 0 ? (
							<p className='text-muted-foreground text-sm'>
								{semLancamentosNoPeriodo
									? `Nenhum lançamento nos últimos ${DIAS_EXTRATO_VISIVEL} dias.`
									: "Nenhum lançamento no extrato."}
							</p>
						) : (
							<ul className='max-h-60 space-y-2 overflow-y-auto pr-1 text-sm'>
								{extratosOrdenados.map((linha, i) => (
									<li
										key={`${nome}-${String(linha.data)}-${i}-${linha.descricao.slice(0, 24)}`}
										className='border-b border-border/60 pb-2 last:border-0'>
										<div className='flex justify-between gap-2'>
											<span className='text-muted-foreground shrink-0 tabular-nums'>
												{new Date(linha.data).toLocaleDateString("pt-BR", {
													day: "2-digit",
													month: "2-digit",
													year: "numeric",
													timeZone: "UTC",
												})}
											</span>
											<span
												className={
													linha.valor >= 0
														? "font-mono text-green-600 tabular-nums dark:text-green-400"
														: "font-mono text-red-600 tabular-nums dark:text-red-400"
												}>
												{formatCurrencyBRL(linha.valor)}
											</span>
										</div>
										<p className='text-foreground/90 mt-0.5 leading-snug'>
											{linha.descricao}
										</p>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</CollapsibleContent>
			</Collapsible>
		</Card>
	);
}
