import { Link } from "react-router";
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

export function AppSidebar() {
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
			</SidebarContent>
		</Sidebar>
	);
}
