import { configureStore } from "@reduxjs/toolkit";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export type Summary = { categoria: string; ordini: number; totale: number };
export type Order = { id: number; data: string; categoria: string; importo: number };

export const api = createApi({
	reducerPath: "api",
	baseQuery: fetchBaseQuery({ baseUrl: "/api/demo-vendite" }),
	endpoints: (build) => ({
		getSummary: build.query<Summary[], void>({ query: () => "/summary" }),
		getOrders: build.query<Order[], number>({
			query: (limit) => `/orders?limit=${limit}`,
		}),
	}),
});

export const store = configureStore({
	reducer: { [api.reducerPath]: api.reducer },
	middleware: (getDefault) => getDefault().concat(api.middleware),
});

export const { useGetSummaryQuery, useGetOrdersQuery } = api;
