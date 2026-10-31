"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import Button from "./Button";
import Modal from "./Modal";

export interface ConfirmOptions {
  title: string;
  content?: ReactNode;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
}

type Ask = (opts: ConfirmOptions) => Promise<boolean>;

const Ctx = createContext<Ask | null>(null);

/** Promise-based confirm dialog replacing window.confirm. A second request cancels the first. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const ask = useCallback<Ask>((opts) => {
    return new Promise<boolean>((resolve) => {
      setPending((prev) => {
        prev?.resolve(false);
        return { opts, resolve };
      });
    });
  }, []);

  const finish = useCallback((v: boolean) => {
    setPending((p) => {
      p?.resolve(v);
      return null;
    });
  }, []);

  const value = useMemo(() => ask, [ask]);
  const o = pending?.opts;
  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal
        open={!!pending}
        title={o?.title ?? ""}
        onClose={() => finish(false)}
        footer={
          <>
            <Button onClick={() => finish(false)}>{o?.cancelText ?? "Cancel"}</Button>
            <Button variant={o?.danger ? "danger" : "primary"} onClick={() => finish(true)}>
              {o?.okText ?? "OK"}
            </Button>
          </>
        }
      >
        {o?.content}
      </Modal>
    </Ctx.Provider>
  );
}

export function useConfirm(): Ask {
  const ask = useContext(Ctx);
  if (!ask) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ask;
}
