import { Hono } from "hono";
import dati from "./dati.json";

// Montata su /api/primo-margine. I dati sono un file rigenerato ogni settimana
// (vedi aggiornamento/README.md): niente tabelle D1.
const api = new Hono<{ Bindings: Env }>();

api.get("/dati", (c) => c.json(dati));

export default api;
