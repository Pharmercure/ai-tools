import { configureStore } from "@reduxjs/toolkit";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Dati } from "./calcoli";

/** Esito dell'ultimo tentativo di aggiornamento; null se non ce ne sono ancora. */
export type Status = {
	id: number;
	created_at: string;
	status: "ok" | "rejected" | "failed";
	log: { problems?: string[]; error?: string };
} | null;

// Chiamate API della dashboard: solo /api/primo-margine/...
export const api = createApi({
	reducerPath: "api",
	baseQuery: fetchBaseQuery({ baseUrl: "/api/primo-margine" }),
	tagTypes: ["Dati"],
	endpoints: (build) => ({
		getDati: build.query<Dati, void>({ query: () => "/dati", providesTags: ["Dati"] }),
		getStatus: build.query<Status, void>({ query: () => "/status" }),
		// La risposta è una riga JSON per volta e finisce quando l'aggiornamento è terminato.
		refresh: build.mutation<void, void>({
			query: () => ({ url: "/refresh", method: "POST", responseHandler: "text" }),
			invalidatesTags: ["Dati"],
		}),
	}),
});

export const store = configureStore({
	reducer: { [api.reducerPath]: api.reducer },
	middleware: (getDefault) => getDefault().concat(api.middleware),
});

export const { useGetDatiQuery, useGetStatusQuery, useRefreshMutation } = api;
