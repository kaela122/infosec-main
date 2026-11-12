import { useCallback, useEffect, useMemo, useState } from "react";
import { DataContext } from "./data-context";
import { api } from "./api";

const EMPTY = { products: [], suppliers: [], movements: [], orders: [], users: [], audit: [] };

const DEFAULT_SESSION = {
  name: "Maria Santos",
  email: "maria.santos@ctinassl.ph",
  role: "Administrator",
};

export function DataProvider({ children }) {
  const [state, setState] = useState(EMPTY);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState(null);
  const [session, setSession] = useState(DEFAULT_SESSION);

  const refresh = useCallback(async () => {
    const data = await api("/bootstrap");
    setState(data);
    setStatus("ready");
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api("/bootstrap")
      .then((data) => {
        if (cancelled) return;
        setState(data);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Run a write against the API, then reload so every page sees the server's truth.
  const write = useCallback(
    async (path, method, body) => {
      const result = await api(path, { method, body, actor: session.name });
      await refresh();
      return result;
    },
    [refresh, session.name],
  );

  const actions = useMemo(
    () => ({
      addProduct: (payload) => write("/products", "POST", payload),
      updateProduct: (id, patch) => write(`/products/${id}`, "PATCH", patch),
      deleteProduct: (id) => write(`/products/${id}`, "DELETE"),
      recordMovement: (payload) => write("/movements", "POST", payload),
      addSupplier: (payload) => write("/suppliers", "POST", payload),
      updateSupplier: (id, patch) => write(`/suppliers/${id}`, "PATCH", patch),
      deleteSupplier: (id) => write(`/suppliers/${id}`, "DELETE"),
      createOrder: (payload) => write("/orders", "POST", payload),
      setOrderStatus: (id, next) => write(`/orders/${id}/status`, "PATCH", { status: next }),
      addUser: (payload) => write("/users", "POST", payload),
      updateUser: (id, patch) => write(`/users/${id}`, "PATCH", patch),
      deleteUser: (id) => write(`/users/${id}`, "DELETE"),
      resetData: () => write("/reset", "POST"),
    }),
    [write],
  );

  const value = useMemo(
    () => ({ ...state, session, setSession, ...actions }),
    [state, session, actions],
  );

  if (status === "loading") {
    return <div className="grid min-h-svh place-items-center text-sm text-slate-500">Loading workspace…</div>;
  }

  if (status === "error") {
    return (
      <div className="grid min-h-svh place-items-center p-6 text-center">
        <div className="max-w-md">
          <p className="text-base font-semibold text-slate-900">Can’t reach the server</p>
          <p className="mt-2 text-sm text-slate-600">
            {error}. Make sure MongoDB is running and start the API with <code>npm run server</code>.
          </p>
          <button
            className="mt-4 rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
            onClick={() => {
              setStatus("loading");
              refresh().catch((err) => {
                setError(err.message);
                setStatus("error");
              });
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export default DataProvider;
