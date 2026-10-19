import { configureStore } from "@reduxjs/toolkit";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { AgreementsImport, Import, LogEntry, MonthView, Owner, QueueItem, UbmImport, Verdict } from "../api/types";

export type MonthSummary = { month: string; loadedAt: string; openItems: number };
export type Me = { email: string; canImport: boolean };
export type UbmView = UbmImport & { loadedAt: string; loadedBy: string };
export type AgreementsView = AgreementsImport & { loadedAt: string; loadedBy: string };

// Chiamate API della dashboard: solo /api/supplier-invoices/...
export const api = createApi({
	reducerPath: "api",
	baseQuery: fetchBaseQuery({ baseUrl: "/api/supplier-invoices" }),
	tagTypes: ["Months", "Month", "Queue", "Log", "Ubm", "Agreements"],
	endpoints: (build) => ({
		getMe: build.query<Me, void>({ query: () => "/me" }),
		getMonths: build.query<MonthSummary[], void>({ query: () => "/months", providesTags: ["Months"] }),
		getMonth: build.query<MonthView, string>({ query: (m) => `/months/${m}`, providesTags: ["Month"] }),
		getQueue: build.query<QueueItem[], boolean>({ query: (open) => `/queue${open ? "?open=1" : ""}`, providesTags: ["Queue"] }),
		getLog: build.query<LogEntry[], string>({ query: (id) => `/queue/${encodeURIComponent(id)}/log`, providesTags: ["Log"] }),
		getUbm: build.query<UbmView, void>({ query: () => "/ubm", providesTags: ["Ubm"] }),
		getAgreements: build.query<AgreementsView, void>({ query: () => "/agreements", providesTags: ["Agreements"] }),
		updateItem: build.mutation<QueueItem, { id: string; verdict?: Verdict; owner?: Owner; note?: string }>({
			query: ({ id, ...body }) => ({ url: `/queue/${encodeURIComponent(id)}`, method: "PATCH", body }),
			invalidatesTags: ["Months", "Month", "Queue", "Log"],
		}),
		importData: build.mutation<{ ok: boolean; kind: string; queueRows: number }, Import>({
			query: (body) => ({ url: "/import", method: "POST", body }),
			invalidatesTags: ["Months", "Month", "Queue", "Ubm", "Agreements"],
		}),
	}),
});

export const store = configureStore({
	reducer: { [api.reducerPath]: api.reducer },
	middleware: (getDefault) => getDefault().concat(api.middleware),
});

export const {
	useGetMeQuery, useGetMonthsQuery, useGetMonthQuery, useGetQueueQuery, useGetLogQuery, useGetUbmQuery, useGetAgreementsQuery,
	useUpdateItemMutation, useImportDataMutation,
} = api;
