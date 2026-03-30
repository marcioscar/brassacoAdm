import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { MesAno } from "~/lib/mes-ano";

type MesAnoContextValue = {
	mesAno: MesAno;
	setMesAno: (mesAno: MesAno) => void;
};

const MesAnoContext = createContext<MesAnoContextValue | null>(null);

type MesAnoProviderProps = {
	initialMesAno: MesAno;
	children: ReactNode;
};

export function MesAnoProvider({ initialMesAno, children }: MesAnoProviderProps) {
	const [mesAno, setMesAno] = useState(initialMesAno);

	useEffect(() => {
		setMesAno(initialMesAno);
	}, [initialMesAno.mes, initialMesAno.ano]);

	return (
		<MesAnoContext.Provider value={{ mesAno, setMesAno }}>
			{children}
		</MesAnoContext.Provider>
	);
}

export function useMesAnoContext() {
	return useContext(MesAnoContext);
}
