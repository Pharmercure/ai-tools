import { useEffect, useState } from "react";

type Note = { id: number; text: string };

export default function Esempio() {
	const [notes, setNotes] = useState<Note[]>([]);
	const [text, setText] = useState("");

	const load = () =>
		fetch("/api/esempio/notes")
			.then((r) => r.json() as Promise<Note[]>)
			.then(setNotes);
	useEffect(() => {
		load();
	}, []);

	async function add() {
		await fetch("/api/esempio/notes", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ text }),
		});
		setText("");
		load();
	}

	return (
		<>
			<h1>Esempio: note</h1>
			<input value={text} onChange={(e) => setText(e.target.value)} />
			<button onClick={add}>Aggiungi</button>
			<ul>
				{notes.map((n) => (
					<li key={n.id}>{n.text}</li>
				))}
			</ul>
		</>
	);
}
