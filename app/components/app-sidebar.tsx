import { useEffect, useState } from "react";
import { Link, useMatches } from "react-router";
import {
	BanknoteArrowUp,
	BanknoteArrowDown,
	ShoppingCart,
	HandCoins,
} from "lucide-react";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "~/components/ui/sidebar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import type { MesAno } from "~/lib/mes-ano";
import { formatarMesAno, parseMesAnoValue } from "~/lib/mes-ano";
import { useMesAnoContext } from "~/context/mes-ano-context";

type FiltroMesAnoData = {
	mesAno: MesAno;
	opcoesMesAno: MesAno[];
};

function obterFiltroMesAno(matches: ReturnType<typeof useMatches>) {
	const matchComFiltro = matches.find((match) => {
		const data = match.data as Partial<FiltroMesAnoData> | undefined;
		return Boolean(data?.mesAno && data?.opcoesMesAno);
	});

	if (!matchComFiltro) return null;

	const data = matchComFiltro.data as FiltroMesAnoData;
	return {
		pathname: matchComFiltro.pathname,
		mesAno: data.mesAno,
		opcoesMesAno: data.opcoesMesAno,
	};
}

export function AppSidebar() {
	const matches = useMatches();
	const mesAnoContext = useMesAnoContext();
	const filtroMesAno = obterFiltroMesAno(matches);
	const [mesAnoValue, setMesAnoValue] = useState("");

	useEffect(() => {
		if (!filtroMesAno) return;
		const opcoes = filtroMesAno.opcoesMesAno.map((opcao) =>
			formatarMesAno(opcao.mes, opcao.ano),
		);
		const atual = mesAnoContext
			? formatarMesAno(mesAnoContext.mesAno.mes, mesAnoContext.mesAno.ano)
			: "";
		const valorInicial = opcoes.includes(atual) ? atual : opcoes[0] ?? "";
		if (!valorInicial) return;
		setMesAnoValue(valorInicial);
		if (mesAnoContext) {
			const parsed = parseMesAnoValue(valorInicial);
			if (
				parsed &&
				(parsed.mes !== mesAnoContext.mesAno.mes ||
					parsed.ano !== mesAnoContext.mesAno.ano)
			) {
				mesAnoContext.setMesAno(parsed);
			}
		}
	}, [filtroMesAno, mesAnoContext]);

	function handleMesAnoChange(value: string) {
		setMesAnoValue(value);
		if (!mesAnoContext) return;
		const parsed = parseMesAnoValue(value);
		if (parsed) {
			mesAnoContext.setMesAno(parsed);
		}
	}

	return (
		<Sidebar collapsible='icon'>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild size='lg'>
							<Link to='/' className='flex items-center gap-2'>
								{/* Logo - visível quando sidebar aberta */}
								<div className='flex min-w-0 flex-1 items-center overflow-hidden  group-data-[collapsible=icon]:hidden'>
									<img
										src='/logo.png'
										alt='Brassaco'
										className='h-8 w-auto object-left'
									/>
								</div>
								{/* Ícone - visível quando sidebar fechada */}
								<div className='hidden size-8 shrink-0 items-center justify-center overflow-hidden  group-data-[collapsible=icon]:flex'>
									<img
										src='/icon.png'
										alt='Brassaco'
										className='size-8 object-contain'
									/>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Navegação</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton asChild>
									<Link to='/despesas'>
										<BanknoteArrowDown color='red' />
										<span>Despesas</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton asChild>
									<Link to='/receitas'>
										<BanknoteArrowUp color='blue' />
										<span>Receitas</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton asChild>
									<Link to='/compras'>
										<ShoppingCart color='green' />
										<span>Compras</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton asChild>
									<Link to='/contas_a_pagar'>
										<HandCoins color='orange' />
										<span>Contas a Pagar</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				{filtroMesAno ? (
					<SidebarGroup>
						<SidebarGroupLabel>Filtro</SidebarGroupLabel>
						<SidebarGroupContent>
							<div className='px-2 text-sm'>
								<label htmlFor='mesAnoSidebar' className='text-xs font-medium'>
									Mês/Ano
								</label>
								<Select value={mesAnoValue} onValueChange={handleMesAnoChange}>
									<SelectTrigger
										id='mesAnoSidebar'
										className='mt-1 w-full text-sm'>
										<SelectValue placeholder='Selecione o mês' />
									</SelectTrigger>
									<SelectContent>
										{filtroMesAno.opcoesMesAno.map((opcao) => {
											const valor = formatarMesAno(opcao.mes, opcao.ano);
											return (
												<SelectItem
													key={`${opcao.mes}-${opcao.ano}`}
													value={valor}>
													{valor}
												</SelectItem>
											);
										})}
									</SelectContent>
								</Select>
							</div>
						</SidebarGroupContent>
					</SidebarGroup>
				) : null}
			</SidebarContent>
		</Sidebar>
	);
}
