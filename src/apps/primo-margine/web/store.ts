import { configureStore } from "@reduxjs/toolkit";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Dati } from "./calcoli";

// Chiamate API della dashboard: solo /api/primo-margine/...
export const api = createApi({
	reducerPath: "api",
	baseQuery: fetchBaseQuery({ baseUrl: "/api/primo-margine" }),
	endpoints: (build) => ({
		getDati: build.query<Dati, void>({ query: () => "/dati" }),
	}),
});

export const store = configureStore({
	reducer: { [api.reducerPath]: api.reducer },
	middleware: (getDefault) => getDefault().concat(api.middleware),
});

export const { useGetDatiQuery } = api;
