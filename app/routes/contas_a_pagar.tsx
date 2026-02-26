import type { Route } from "./+types/contas_a_pagar";
import { DataTable } from "~/components/desp-table";
import { getColumns } from "~/components/columns-desp";
import { DespesaSelectionActions } from "~/components/despesa-selection-actions";
import {
	createContaAPagar,
	getContasAPagar,
	updateDespesaPartial,
	deleteDespesa,
} from "~/models/despesas.server";
import { uploadReciboAndGetUrl } from "~/models/nextcloud.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
import { useFetcher, redirect, useSearchParams } from "react-router";
import { useState, useEffect, useRef } from "react";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "~/components/ui/combobox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { cn, parseLocalDate } from "~/lib/utils";
import { z } from "zod";
import { getFornecedores } from "~/models/fornecedor.server";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Contas a Pagar" },
		{ name: "description", content: "Contas a Pagar" },
	];
}

const CONTAS = [
	"Revenda",
	"Servicos",
	"Impostos",
	"Pessoal",
	"Transporte",
] as const;

const TIPOS = ["fixo", "variavel"] as const;
const LOJAS = ["QI", "QNE", "NRT", "SDS"] as const;

const formSchema = z.object({
	conta: z.enum(CONTAS, {
		errorMap: () => ({ message: "Conta é obrigatória" }),
	}),
	valor: z.coerce.number().min(0, "Valor deve ser positivo"),
	descricao: z.string().min(1, "Descrição é obrigatória"),
	fornecedor: z.string().min(1, "Fornecedor é obrigatório"),
	tipo: z.enum(TIPOS, {
		errorMap: () => ({ message: "Tipo é obrigatório" }),
	}),
	data: z.coerce.date(),
	comprovante: z.string().optional(),
	loja: z.enum(LOJAS, {
		errorMap: () => ({ message: "Loja é obrigatória" }),
	}),
});

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "delete") {
		const id = formData.get("id");
		if (typeof id === "string") {
			await deleteDespesa(id);
		}
		throw redirect("/contas_a_pagar");
	}

	if (intent === "marcarPaga") {
		const id = formData.get("id");
		if (typeof id === "string") {
			await updateDespesaPartial(id, { pago: true });
		}
		throw redirect("/contas_a_pagar");
	}

	if (intent === "edit") {
		const id = formData.get("id");
		if (typeof id !== "string") {
			return Response.json({ error: "ID inválido" }, { status: 400 });
		}
		const dataStr = formData.get("data");
		const data = dataStr ? parseLocalDate(String(dataStr)) : undefined;
		await updateDespesaPartial(id, {
			conta: String(formData.get("conta") ?? ""),
			valor: Number(formData.get("valor")),
			descricao: String(formData.get("descricao") ?? ""),
			fornecedor: String(formData.get("fornecedor") ?? ""),
			tipo: String(formData.get("tipo") ?? ""),
			loja: String(formData.get("loja") ?? ""),
			...(data && { data }),
		});
		throw redirect("/contas_a_pagar");
	}

	if (intent === "uploadComprovante") {
		const id = formData.get("id");
		const file = formData.get("comprovante");
		const dataStr = formData.get("data");
		if (typeof id !== "string" || !(file instanceof File) || file.size === 0) {
			return Response.json({ error: "Arquivo obrigatório" }, { status: 400 });
		}
		const buffer = Buffer.from(await file.arrayBuffer());
		const dataPrefix = dataStr
			? String(dataStr).slice(0, 10)
			: new Date().toISOString().slice(0, 10);
		const nomeComData = `${dataPrefix}-${file.name}`;
		const comprovanteUrl = await uploadReciboAndGetUrl(buffer, nomeComData);
		await updateDespesaPartial(id, { comprovante: comprovanteUrl });
		throw redirect("/contas_a_pagar");
	}

	// Create (sem intent)
	const data = Object.fromEntries(
		[...formData.entries()].filter(
			([k]) => k !== "boleto" && k !== "intent" && k !== "id",
		),
	);

	const validated = formSchema.safeParse(data);
	if (!validated.success) {
		return Response.json(
			{ errors: validated.error.flatten().fieldErrors },
			{ status: 400 },
		);
	}

	let boletoUrl: string | undefined;
	const file = formData.get("boleto");
	if (file instanceof File && file.size > 0) {
		const buffer = Buffer.from(await file.arrayBuffer());
		const dataDespesa = validated.data.data;
		const dataPrefix = new Date(dataDespesa).toISOString().slice(0, 10); // YYYY-MM-DD
		const nomeComData = `boleto-${dataPrefix}-${file.name}`;
		boletoUrl = await uploadReciboAndGetUrl(buffer, nomeComData);
	}

	await createContaAPagar({
		...validated.data,
		boleto: boletoUrl,
		pago: false,
	});
	throw redirect("/contas_a_pagar");
}

/** Carrega as contas a pagar */
export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const filtro = (url.searchParams.get("filtro") ?? "todas") as
		| "hoje"
		| "todas";
	const contasAPagar = await getContasAPagar({ filtro });
	const fornecedores = await getFornecedores();
	return { contasAPagar, fornecedores, filtro };
}
export default function ContasAPagar({ loaderData }: Route.ComponentProps) {
	const { contasAPagar, fornecedores, filtro } = loaderData;
	const [searchParams, setSearchParams] = useSearchParams();
	const fetcher = useFetcher<{ errors?: Record<string, string[]> }>();
	const busy = fetcher.state !== "idle";
	const [conta, setConta] = useState("");
	const [tipo, setTipo] = useState("");
	const [loja, setLoja] = useState("");
	const [fornecedor, setFornecedor] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const submittedRef = useRef(false);

	function handleFiltroChange(value: string) {
		setSearchParams(value === "hoje" ? { filtro: "hoje" } : {});
	}

	useEffect(() => {
		if (fetcher.state === "idle" && submittedRef.current) {
			submittedRef.current = false;
			if (!fetcher.data?.errors) {
				setDialogOpen(false);
				setConta("");
				setTipo("");
				setLoja("");
				setFornecedor("");
			}
		}
		if (fetcher.state === "submitting") {
			submittedRef.current = true;
		}
	}, [fetcher.state, fetcher.data?.errors]);

	return (
		<div className='container mx-auto'>
			<div className='mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
				<div className='flex items-center gap-4'>
					<h1 className='text-2xl font-bold'>Contas a Pagar</h1>
					<Select value={filtro} onValueChange={handleFiltroChange}>
						<SelectTrigger className='w-[140px]'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='hoje'>Hoje</SelectItem>
							<SelectItem value='todas'>Todas</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
					<DialogTrigger asChild>
						<Button variant='secondary'>
							<Plus className='size-4' />
							Nova Conta a Pagar
						</Button>
					</DialogTrigger>
					<DialogContent className='max-w-lg'>
						<div className={cn("flex flex-col gap-6")}>
							<DialogHeader>
								<DialogTitle>Nova Conta a Pagar</DialogTitle>
							</DialogHeader>
							<fetcher.Form
								method='post'
								encType='multipart/form-data'
								className='flex flex-col gap-6'>
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
										<FieldLabel htmlFor='conta'>Conta</FieldLabel>
										<Select
											value={conta}
											onValueChange={setConta}
											disabled={busy}>
											<SelectTrigger id='conta' className='w-full'>
												<SelectValue placeholder='Selecione a conta' />
											</SelectTrigger>
											<SelectContent>
												{CONTAS.map((c) => (
													<SelectItem key={c} value={c}>
														{c}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<input type='hidden' name='conta' value={conta} />
										<FieldError
											errors={fetcher.data?.errors?.conta?.map((m) => ({
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
										<FieldLabel htmlFor='descricao'>Descrição</FieldLabel>
										<Input
											id='descricao'
											name='descricao'
											placeholder='Descrição da despesa'
											required
											disabled={busy}
										/>
										<FieldError
											errors={fetcher.data?.errors?.descricao?.map((m) => ({
												message: m,
											}))}
										/>
									</Field>

									<Field>
										<FieldLabel htmlFor='tipo'>Tipo</FieldLabel>
										<Select
											value={tipo}
											onValueChange={setTipo}
											disabled={busy}>
											<SelectTrigger id='tipo' className='w-full'>
												<SelectValue placeholder='Selecione o tipo' />
											</SelectTrigger>
											<SelectContent>
												{TIPOS.map((t) => (
													<SelectItem key={t} value={t}>
														{t}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<input type='hidden' name='tipo' value={tipo} />
										<FieldError
											errors={fetcher.data?.errors?.tipo?.map((m) => ({
												message: m,
											}))}
										/>
									</Field>
									<Field>
										<FieldLabel htmlFor='loja'>Loja</FieldLabel>
										<Select
											value={loja}
											onValueChange={setLoja}
											disabled={busy}>
											<SelectTrigger id='loja' className='w-full'>
												<SelectValue placeholder='Selecione a loja' />
											</SelectTrigger>
											<SelectContent>
												{LOJAS.map((l) => (
													<SelectItem key={l} value={l}>
														{l}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<input type='hidden' name='loja' value={loja} />
										<FieldError
											errors={fetcher.data?.errors?.loja?.map((m) => ({
												message: m,
											}))}
										/>
									</Field>

									<Field className='col-span-2'>
										<FieldLabel htmlFor='boleto'>Boleto</FieldLabel>
										<Input
											id='boleto'
											name='boleto'
											type='file'
											accept='.pdf,.jpg,.jpeg,.png,.webp'
											disabled={busy}
											className='cursor-pointer'
										/>
										<p className='text-muted-foreground mt-1 text-xs'>
											PDF ou imagem (opcional)
										</p>
										<FieldError
											errors={fetcher.data?.errors?.boleto?.map((m) => ({
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
			<DataTable
				columns={getColumns({ variant: "contas_a_pagar", enableSelection: true })}
				data={contasAPagar}
				enableRowSelection
				selectionActions={(selected) => (
					<DespesaSelectionActions
						selectedRows={selected}
						variant="contas_a_pagar"
						fornecedores={fornecedores}
					/>
				)}
			/>
		</div>
	);
}
