"use client";

import * as React from "react";
import { cn } from "~/lib/utils";

interface DropdownMenuContextValue {
	open: boolean;
	setOpen: (open: boolean) => void;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenu() {
	const ctx = React.useContext(DropdownMenuContext);
	if (!ctx) throw new Error("DropdownMenu components must be used within DropdownMenu");
	return ctx;
}

function DropdownMenu({ children }: { children: React.ReactNode }) {
	const [open, setOpen] = React.useState(false);
	return (
		<DropdownMenuContext.Provider value={{ open, setOpen }}>
			<div className="relative">{children}</div>
		</DropdownMenuContext.Provider>
	);
}

function DropdownMenuTrigger({
	children,
	className,
	asChild,
	...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
	const { open, setOpen } = useDropdownMenu();

	React.useEffect(() => {
		if (!open) return;
		const handleClick = () => setOpen(false);
		document.addEventListener("click", handleClick, true);
		return () => document.removeEventListener("click", handleClick, true);
	}, [open, setOpen]);

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		setOpen((v) => !v);
	};

	if (asChild && React.isValidElement(children)) {
		return React.cloneElement(children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>, {
			type: "button",
			onClick: (e: React.MouseEvent) => {
				(children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>).props.onClick?.(e);
				handleClick(e);
			},
		});
	}

	return (
		<button type="button" className={cn(className)} onClick={handleClick} {...props}>
			{children}
		</button>
	);
}

function DropdownMenuContent({
	children,
	align = "end",
	className,
	...props
}: React.ComponentProps<"div"> & { align?: "start" | "end" }) {
	const { open } = useDropdownMenu();
	if (!open) return null;

	return (
		<div
			className={cn(
				"absolute top-full mt-1 z-[100] min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
				align === "end" ? "right-0" : "left-0",
				className,
			)}
			onClick={(e) => e.stopPropagation()}
			{...props}
		>
			{children}
		</div>
	);
}

function DropdownMenuItem({
	className,
	onClick,
	children,
	disabled = false,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & { variant?: "default" | "destructive"; disabled?: boolean }) {
	const { setOpen } = useDropdownMenu();

	return (
		<div
			role="menuitem"
			aria-disabled={disabled}
			className={cn(
				"relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0",
				disabled && "pointer-events-none opacity-50",
				variant === "destructive" && "text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive",
				className,
			)}
			onClick={(e) => {
				if (disabled) return;
				onClick?.(e);
				setOpen(false);
			}}
			{...props}
		>
			{children}
		</div>
	);
}

function DropdownMenuLabel({ className, children, ...props }: React.ComponentProps<"div">) {
	return (
		<div className={cn("px-2 py-1.5 text-sm font-medium", className)} {...props}>
			{children}
		</div>
	);
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<"div">) {
	return <div className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

export {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
};
