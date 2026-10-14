import { useState } from "react";
import { Provider } from "react-redux";
import { store, useAddNoteMutation, useGetNotesQuery } from "./store";

function Notes() {
	const { data: notes, isLoading, isError } = useGetNotesQuery();
	const [addNote, { isLoading: isSaving }] = useAddNoteMutation();
	const [text, setText] = useState("");

	async function add() {
		await addNote(text).unwrap();
		setText("");
	}

	if (isLoading) return <p>Caricamento…</p>;
	if (isError || !notes) return <p>Impossibile caricare le note</p>;
	return (
		<>
			<h1>Esempio: note</h1>
			<div css={{ display: "flex", gap: 8 }}>
				<input value={text} onChange={(e) => setText(e.target.value)} />
				<button disabled={isSaving} onClick={add}>
					Aggiungi
				</button>
			</div>
			<ul>
				{notes.map((n) => (
					<li key={n.id}>{n.text}</li>
				))}
			</ul>
		</>
	);
}

export default function Esempio() {
	return (
		<Provider store={store}>
			<Notes />
		</Provider>
	);
}
