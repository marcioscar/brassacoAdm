import type { Route } from "./+types/compras";
import {
	getCompras,
	createCompra,
	updateCompra,
	deleteCompra,
} from "~/models/compras.server";
import {
	getFornecedores,
	createFornecedor,
} from "~/models/fornecedor.server";
import { DataTable } from "~/components/desp-table";
import { getColumns } from "~/components/columns-compra";
import { CompraSelectionActions } from "~/components/compra-selection-actions";
import { Button } from "~/components/ui/button";
import { Plus } from "lucide-react";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldError,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "~/components/ui/combobox";
import { useFetcher, redirect } from "react-router";
import { useState, useEffect, useRef } from "react";
import { parseLocalDate } from "~/lib/utils";
import { z } from "zod";

export function meta({}: Route.MetaArgs) {
	return [{ title: "Compras" }, { name: "description", content: "Compras" }];
}

const formSchema = z.object({
	fornecedor: z.string().min(1, "Fornecedor é obrigatório"),
	valor: z.coerce.number().min(0, "Valor deve ser positivo"),
	nf: z
		.union([z.string(), z.coerce.number()])
		.transform((v) =>
			typeof v === "number" ? String(v) : (v ?? "").toString(),
		)
		.optional()
		.default(""),
	data: z.coerce.date(),
});

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "createFornecedor") {
		const nome = String(formData.get("nome") ?? "").trim();
		if (!nome) {
			return Response.json(
				{ errors: { nome: ["Nome é obrigatório"] } },
				{ status: 400 },
			);
		}
		await createFornecedor({ nome });
		throw redirect("/compras");
	}

	if (intent === "delete") {
		const id = formData.get("id");
		if (typeof id === "string") {
			await deleteCompra(id);
		}
		throw redirect("/compras");
	}

	if (intent === "edit") {
		const id = formData.get("id");
		if (typeof id !== "string") {
			return Response.json({ error: "ID inválido" }, { status: 400 });
		}
		const editData = {
			fornecedor: String(formData.get("fornecedor") ?? ""),
			valor: Number(formData.get("valor")),
			nf: String(formData.get("nf") ?? ""),
			data: formData.get("data")
				? parseLocalDate(String(formData.get("data")))
				: new Date(),
		};
		const validated = formSchema.safeParse(editData);
		if (!validated.success) {
			return Response.json(
				{ errors: validated.error.flatten().fieldErrors },
				{ status: 400 },
			);
		}
		await updateCompra(id, validated.data);
		throw redirect("/compras");
	}

	// Create (sem intent)
	const data = Object.fromEntries(
		[...formData.entries()].filter(
			([k]: [string, FormDataEntryValue]) => k !== "intent" && k !== "id",
		),
	);
	const validated = formSchema.safeParse(data);
	if (!validated.success) {
		return Response.json(
			{ errors: validated.error.flatten().fieldErrors },
			{ status: 400 },
		);
	}
	await createCompra(validated.data);
	throw redirect("/compras");
}

export async function loader() {
	const [compras, fornecedores] = await Promise.all([
		getCompras(),
		getFornecedores(),
	]);
	return { compras, fornecedores };
}

export default function Compras({ loaderData }: Route.ComponentProps) {
	const { compras, fornecedores } = loaderData;
	const fetcher = useFetcher<{ errors?: Record<string, string[]> }>();
	const busy = fetcher.state !== "idle";
	const [fornecedor, setFornecedor] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [fornecedorDialogOpen, setFornecedorDialogOpen] = useState(false);
	const submittedRef = useRef(false);
	const fornecedorFetcher = useFetcher<{ errors?: Record<string, string[]> }>();

	useEffect(() => {
		if (fetcher.state === "idle" && submittedRef.current) {
			submittedRef.current = false;
			if (!fetcher.data?.errors) {
				setDialogOpen(false);
				setFornecedor("");
			}
		}
		if (fetcher.state === "submitting") {
			submittedRef.current = true;
		}
	}, [fetcher.state, fetcher.data?.errors]);

	return (
		<div className='container mx-auto'>
			<div className='mb-4 flex items-center justify-between'>
				<h1 className='text-2xl font-bold'>Compras</h1>
				<div className='flex items-center gap-2'>
					<Button
						type='button'
						variant='outline'
						onClick={() => setFornecedorDialogOpen(true)}>
						<Plus className='mr-1.5 size-4' />
						Adicionar fornecedor
					</Button>
					<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
						<DialogTrigger asChild>
							<Button variant='secondary'>
								<Plus className='size-4' />
								Nova Compra
							</Button>
						</DialogTrigger>
						<DialogContent className='max-w-lg'>
						<div className='flex flex-col gap-6'>
							<DialogHeader>
								<DialogTitle>Nova Compra</DialogTitle>
							</DialogHeader>
							<fetcher.Form method='post' className='flex flex-col gap-6'>
								<FieldGroup className='grid grid-cols-2 gap-4'>
									<Field className='col-span-2'>
										<FieldLabel htmlFor='fornecedor'>Fornecedor</FieldLabel>
										<Combobox
											items={fornecedores.map((f) => f.nome ?? f.id)}
											value={fornecedor || null}
											onValueChange={(v) => setFornecedor(v ?? "")}>
											<ComboboxInput
												id='fornecedor'
												placeholder='Selecione o fornecedor'
												disabled={busy}
												className='w-full'
											/>
											<ComboboxContent>
												<ComboboxEmpty>
													Nenhum fornecedor encontrado.
												</ComboboxEmpty>
												<ComboboxList>
													{(item) => (
														<ComboboxItem key={item} value={item}>
															{item}
														</ComboboxItem>
													)}
												</ComboboxList>
											</ComboboxContent>
										</Combobox>
										<input type='hidden' name='fornecedor' value={fornecedor} />
										<FieldError
											errors={fetcher.data?.errors?.fornecedor?.map((m) => ({
												message: m,
											}))}
										/>
									</Field>
									<Field>
										<FieldLabel htmlFor='data'>Data</FieldLabel>
										<Input
											id='data'
											name='data'
											type='date'
											defaultValue={new Date().toISOString().split("T")[0]}
											required
											disabled={busy}
										/>
										<FieldError
											errors={fetcher.data?.errors?.data?.map((m) => ({
												message: m,
											}))}
										/>
									</Field>
									<Field>
										<FieldLabel htmlFor='valor'>Valor</FieldLabel>
										<Input
											id='valor'
											name='valor'
											type='number'
											step='0.01'
											min='0'
											placeholder='0,00'
											required
											disabled={busy}
										/>
										<FieldError
											errors={fetcher.data?.errors?.valor?.map((m) => ({
												message: m,
											}))}
										/>
									</Field>
									<Field>
										<FieldLabel htmlFor='nf'>NF</FieldLabel>
										<Input
											id='nf'
											name='nf'
											type='text'
											placeholder='Ex: 123 ou 12345'
											disabled={busy}
										/>
										<FieldError
											errors={fetcher.data?.errors?.nf?.map((m) => ({
												message: m,
											}))}
										/>
									</Field>
									<Field className='col-span-2'>
										<DialogFooter className='sm:justify-end'>
											<DialogClose asChild>
												<Button type='button' variant='outline' disabled={busy}>
													Cancelar
												</Button>
											</DialogClose>
											<Button type='submit' disabled={busy}>
												{busy ? "Salvando..." : "Salvar"}
											</Button>
										</DialogFooter>
									</Field>
								</FieldGroup>
							</fetcher.Form>
						</div>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			{/* Dialog Novo Fornecedor */}
			<Dialog
				open={fornecedorDialogOpen}
				onOpenChange={setFornecedorDialogOpen}>
				<DialogContent className='max-w-sm'>
					<DialogHeader>
						<DialogTitle>Novo fornecedor</DialogTitle>
					</DialogHeader>
					<fornecedorFetcher.Form method='post' className='flex flex-col gap-4'>
						<input type='hidden' name='intent' value='createFornecedor' />
						<Field>
							<FieldLabel htmlFor='nome-fornecedor'>Nome</FieldLabel>
							<Input
								id='nome-fornecedor'
								name='nome'
								placeholder='Nome do fornecedor'
								required
								disabled={fornecedorFetcher.state !== "idle"}
							/>
							<FieldError
								errors={fornecedorFetcher.data?.errors?.nome?.map((m) => ({
									message: m,
								}))}
							/>
						</Field>
						<DialogFooter>
							<Button
								type='button'
								variant='outline'
								onClick={() => setFornecedorDialogOpen(false)}>
								Cancelar
							</Button>
							<Button
								type='submit'
								disabled={fornecedorFetcher.state !== "idle"}>
								{fornecedorFetcher.state !== "idle"
									? "Salvando..."
									: "Salvar"}
							</Button>
						</DialogFooter>
					</fornecedorFetcher.Form>
				</DialogContent>
			</Dialog>

			<DataTable
				columns={getColumns({ variant: "compras", enableSelection: true })}
				data={compras as import("~/components/columns-compra").Compra[]}
				enableRowSelection
				getRowId={(row) => row.id}
				selectionActions={(selected) => (
					<CompraSelectionActions
						selectedRows={selected}
						fornecedores={fornecedores}
					/>
				)}
				filterColumn='fornecedor'
				filterPlaceholder='Filtrar por fornecedor...'
			/>
		</div>
	);
}
