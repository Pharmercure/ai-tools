import { Box, Chip, Paper, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { VERDICT, VERDICT_ORDER } from "./format";
import { ROLES, type Role } from "./roles";

function Block({ title, children }: { title: string; children: ReactNode }) {
	return (
		<Paper sx={{ p: 2, mb: 1.5 }}>
			<Typography variant="h2" component="h2" sx={{ mb: 1 }}>{title}</Typography>
			{children}
		</Paper>
	);
}

const P = ({ children }: { children: ReactNode }) => <Typography variant="body2" sx={{ mb: 1 }}>{children}</Typography>;

export function HelpPage() {
	return (
		<Box sx={{ maxWidth: 820 }}>
			<Block title="A cosa serve">
				<P>
					Ogni mese paghiamo una ventina di fornitori esterni di consegne. Qui confrontiamo la fattura di ognuno con quanto abbiamo
					calcolato noi dalle consegne, con il suo accordo: il <b>previsto</b>. Quando non coincidono, la persona giusta decide chi ha
					ragione. Quando un accordo produce differenze ogni mese, lo si chiarisce con il fornitore, così dal mese dopo torna da solo.
				</P>
				<P>L'obiettivo è pagare il giusto e saperlo prima: costi prevedibili, e nessuna voce pagata senza accordo.</P>
			</Block>
			<Block title="Chi fa cosa">
				{(Object.keys(ROLES) as Role[]).map((r) => (
					<P key={r}><b>{ROLES[r].label}</b>: {ROLES[r].help}</P>
				))}
				<P>
					Lo strumento è del responsabile dei rapporti con i fornitori: è lui che decide gli scostamenti e i punti aperti. Quando gli
					serve una verifica su una consegna chiede supporto alla gestione operativa dalla riga stessa («Chiedi supporto»); la riga
					compare allora nella pagina «Da fare» della gestione operativa, finché qualcuno non decide o la riporta al responsabile.
				</P>
			</Block>
			<Block title="I verdetti">
				{VERDICT_ORDER.map((v) => (
					<Box key={v} sx={{ display: "flex", gap: 1, alignItems: "baseline", mb: 0.75 }}>
						<Chip size="small" color={VERDICT[v].tone} label={VERDICT[v].label} sx={{ minWidth: 130 }} />
						<Typography variant="body2">{VERDICT[v].help}</Typography>
					</Box>
				))}
				<P>Non c'è una soglia sotto la quale una differenza si ignora da sola: lo decide una persona. Quando la differenza è a nostro favore non si approfondisce.</P>
			</Block>
			<Block title="Il costo da caricare">
				<P>
					Il costo effettivo di un fornitore si carica nel backadmin solo quando la fattura torna con il previsto, oppure quando tutti i
					suoi scostamenti del mese hanno un verdetto. Finché uno scostamento è aperto resta il costo previsto.
				</P>
			</Block>
			<Block title="Gli accordi">
				<P>
					Nella pagina di ogni fornitore ci sono il nostro accordo e quello che il fornitore applica davvero. Dove non coincidono c'è un
					punto aperto, con i fatti, quanto vale e la domanda. Quando è chiarito si scrive l'esito e si chiude: l'esito è la regola che
					va nel Registro Accordi, da cui si calcola il previsto dei mesi successivi.
				</P>
			</Block>
			<Block title="Binario A e binario B">
				<P><b>Binario A</b>: il 1° del mese mandiamo noi al fornitore il riepilogo da fatturare. <b>Binario B</b>: aspettiamo la fattura e la confrontiamo. L'obiettivo è portare tutti in A.</P>
			</Block>
			<Block title="Da dove vengono i dati">
				<P>
					Il previsto si calcola dalle consegne del database di produzione e dalle note degli ordini; le fatture vengono da Fatture in
					Cloud; il dettaglio consegna per consegna dai file dei fornitori. Il procedimento completo è nella KB, pagina «Verifica
					mensile delle fatture dei fornitori esterni». Referente: Gianluca Abate.
				</P>
			</Block>
		</Box>
	);
}
