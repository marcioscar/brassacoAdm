const currencyFormatterBRL = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

export function formatCurrencyBRL(value: number) {
	return currencyFormatterBRL.format(value);
}
