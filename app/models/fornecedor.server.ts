import { db } from "~/db.server";
import { Prisma } from "@prisma/client";
import { limparDocumento, tipoPessoaDe, validarCpfCnpj } from "~/lib/documento";

/** Só os ativos: o ERP desativa fornecedor em vez de apagar. */
export async function getFornecedores() {
	return db.fornecedores.findMany({
		where: { ativo: { not: false } },
		orderBy: { nome: "asc" },
		select: {
			id: true,
			nome: true,
		},
	});
}

export type FornecedorEntrada = {
	nome: string;
	cidade: string;
	bairro: string;
	documento?: string;
};

export type ErrosFornecedor = Partial<Record<keyof FornecedorEntrada, string[]>>;

export function validarFornecedor(entrada: FornecedorEntrada) {
	const erros: ErrosFornecedor = {};
	if (entrada.nome.length < 2) erros.nome = ["Informe o nome (razão social)"];
	if (!entrada.cidade) erros.cidade = ["Informe a cidade"];
	if (!entrada.bairro) erros.bairro = ["Informe o bairro"];
	// Vazio é vazio, e preenchido tem que ser válido — a mesma regra do ERP.
	if (entrada.documento && !validarCpfCnpj(entrada.documento)) {
		erros.documento = ["CNPJ/CPF inválido"];
	}
	return Object.keys(erros).length > 0 ? erros : null;
}

/**
 * O próximo código livre, com a mesma regra do ERP: o maior que existe, mais
 * um, com seis dígitos e zero à esquerda. Como a largura é fixa, o maior por
 * ordem alfabética é o maior de verdade.
 */
async function proximoCodigo() {
	const ultimo = await db.fornecedores.findFirst({
		where: { codigo: { not: null } },
		orderBy: { codigo: "desc" },
		select: { codigo: true },
	});
	const proximo = (Number(ultimo?.codigo ?? 0) || 0) + 1;
	return String(proximo).padStart(6, "0");
}

/**
 * Grava o fornecedor no formato completo do ERP (ver o model no schema).
 *
 * Se duas telas cadastrarem ao mesmo tempo, as duas calculam o mesmo código e
 * o índice único recusa a segunda — então tenta de novo com o código seguinte.
 */
export async function createFornecedor(entrada: FornecedorEntrada) {
	const documento = entrada.documento ? limparDocumento(entrada.documento) : null;
	for (let tentativa = 0; ; tentativa++) {
		const agora = new Date();
		try {
			return await db.fornecedores.create({
				data: {
					codigo: await proximoCodigo(),
					nome: entrada.nome,
					nomeFantasia: null,
					cidade: entrada.cidade,
					bairro: entrada.bairro,
					documento,
					tipoPessoa: documento ? tipoPessoaDe(documento) : null,
					ativo: true,
					criadoEm: agora,
					atualizadoEm: agora,
				},
			});
		} catch (erro) {
			const codigoDuplicado =
				erro instanceof Prisma.PrismaClientKnownRequestError &&
				erro.code === "P2002";
			if (!codigoDuplicado || tentativa >= 2) throw erro;
		}
	}
}
