import { Outlet } from "react-router";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "~/components/ui/sidebar";
import { AppSidebar } from "~/components/app-sidebar";

export default function Layout() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className='flex h-16 shrink-0 items-center gap-2 px-4'>
					<SidebarTrigger className='-ml-1' />
					<h1 className='flex flex-1 mt-4 justify-center'>
						<img
							src='/logo.png'
							alt='Brassaco ADM'
							className='h-14 w-auto object-contain'
						/>
					</h1>
				</header>
				<div className='flex-1 overflow-auto p-4'>
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
