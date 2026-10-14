---
name: stack-frontend
description: Librerie obbligatorie per il frontend delle dashboard (Emotion per lo stile, React Router per le pagine, Redux Toolkit + RTK Query per stato e chiamate API) e come usarle. Da leggere prima di scrivere o modificare qualsiasi componente React.
---

# Stack frontend

Usa **solo** queste librerie per questi compiti. Non aggiungere alternative (styled-components, Tailwind, axios, SWR, React Query, zustand, ecc.). Se manca qualcosa, avvisa l'utente prima di installare un pacchetto: è condiviso da tutte le dashboard.

| Compito | Libreria |
| --- | --- |
| Stile | Emotion (`@emotion/react`, `@emotion/styled`) |
| Pagine e link | `react-router` (importa sempre da `"react-router"`) |
| Stato e chiamate API | Redux Toolkit + RTK Query (`@reduxjs/toolkit`, `react-redux`) |

Per ogni esempio completo guarda `src/apps/esempio` e `src/apps/demo-vendite`.

## Componenti UI: MUI

`@mui/material` (usa Emotion, già installato) è il kit di componenti della shell e delle dashboard che lo vogliono. Le dashboard esistenti con HTML semplice (`esempio`, `demo-vendite`) continuano a funzionare. Per ora lo usa `primo-margine`.

- **Il tema è della shell** (`src/shell/theme.ts`, applicato in `src/shell/main.tsx`): le dashboard non creano un proprio `ThemeProvider` né usano `CssBaseline`. Lo sfondo e il font della pagina li imposta la shell. Chiaro e scuro seguono il sistema.
- La shell fornisce intestazione, percorso (briciole di pane) ed elenco delle dashboard a schede. La dashboard riempie il contenuto, larga fino a 1536 px.
- Sui componenti MUI lo stile si scrive con `sx`; sugli elementi HTML normali resta la prop `css`. Per i colori usa la palette del tema (`theme.palette`, o i nomi come `text.secondary` dentro `sx`), mai colori scritti a mano.
- Non importare `@mui/icons-material` (pesante): usa pochi SVG propri.
- Nessun pacchetto `@mui/x-*` senza averlo concordato (Pro e Premium sono a pagamento).

## Stile: Emotion

Usa la prop `css` con un oggetto; nessun import necessario (è già configurato).

```tsx
<div css={{ display: "flex", gap: 8, "a.active": { fontWeight: 700 } }}>…</div>
```

Per componenti riusati più volte: `import styled from "@emotion/styled"`. Valori che cambiano a runtime (es. la larghezza di una barra) vanno in `style={{...}}`, non in `css`. Niente file `.css` nelle dashboard: lo stile globale vive solo in `src/shell/index.css`.

## Pagine: React Router

Il router (`BrowserRouter`) è già nella shell: **non crearne un altro** nelle dashboard. La dashboard `<nome>` è montata su `/<nome>/*` e definisce le sue sottopagine con `<Routes>` **relative**:

```tsx
<Routes>
  <Route index element={<Riepilogo />} />          {/* /<nome> */}
  <Route path="ordini" element={<Ordini />} />     {/* /<nome>/ordini */}
</Routes>
<NavLink to="ordini">Tutti gli ordini</NavLink>     {/* link relativo */}
```

- Link interni sempre con `<Link>`/`<NavLink>`, mai `<a href>` (ricaricherebbe la pagina).
- Mai link verso altre dashboard, tranne `<Link to="/">` per l'indice (già fornito dalla shell).

## Stato e API: Redux Toolkit + RTK Query

Ogni dashboard ha il **proprio** store in `web/store.ts`: un `createApi` con `baseUrl: "/api/<nome>"` e `configureStore`. `web/index.tsx` avvolge tutto in `<Provider store={store}>`. Non condividere store tra dashboard.

- Lettura: `build.query` + `providesTags`; scrittura: `build.mutation` + `invalidatesTags` (l'elenco si ricarica da solo).
- Nei componenti usa gli hook generati (`useGetXQuery`, `useAddXMutation`), mai `fetch` a mano.
- Gestisci sempre `isLoading` e `isError`: mostra un messaggio chiaro all'utente.
- `createApi` per i dati che arrivano dal server; `createSlice` solo per stato locale della UI condiviso tra più componenti (filtri, selezioni). Per stato di un singolo componente basta `useState`.
