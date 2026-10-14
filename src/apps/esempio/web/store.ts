import { configureStore } from "@reduxjs/toolkit";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export type Note = { id: number; text: string };

// Chiamate API della dashboard: solo /api/esempio/...
export const api = createApi({
	reducerPath: "api",
	baseQuery: fetchBaseQuery({ baseUrl: "/api/esempio" }),
	tagTypes: ["Note"],
	endpoints: (build) => ({
		getNotes: build.query<Note[], void>({
			query: () => "/notes",
			providesTags: ["Note"],
		}),
		addNote: build.mutation<void, string>({
			query: (text) => ({ url: "/notes", method: "POST", body: { text } }),
			invalidatesTags: ["Note"], // dopo l'aggiunta l'elenco si ricarica da solo
		}),
	}),
});

export const store = configureStore({
	reducer: { [api.reducerPath]: api.reducer },
	middleware: (getDefault) => getDefault().concat(api.middleware),
});

export const { useGetNotesQuery, useAddNoteMutation } = api;
