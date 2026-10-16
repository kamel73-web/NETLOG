import { supabase } from "./supabase";

export interface WalletSummary {
  solde: number;
  reserve: number;
  disponible: number;
  blocage_actif: boolean;
}
export interface WalletTx {
  id: number;
  type: string;
  amount_ht: number;
  reference: string | null;
  note: string | null;
  created_at: string;
}
export interface WalletTopup {
  id: number;
  amount_ht: number;
  mode: string;
  reference: string | null;
  status: string;
  decision_note: string | null;
  created_at: string;
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));

export async function loadMyWallet(): Promise<WalletSummary> {
  const { data, error } = await supabase.rpc("my_wallet");
  if (error) throw new Error(error.message);
  const r: any = Array.isArray(data) ? data[0] : data;
  return {
    solde: n(r?.solde),
    reserve: n(r?.reserve),
    disponible: n(r?.disponible),
    blocage_actif: Boolean(r?.blocage_actif),
  };
}

export async function loadMyWalletTx(): Promise<WalletTx[]> {
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("id, type, amount_ht, reference, note, created_at")
    .order("id", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return ((data as any[]) ?? []).map((t) => ({
    id: Number(t.id),
    type: t.type,
    amount_ht: n(t.amount_ht),
    reference: t.reference ?? null,
    note: t.note ?? null,
    created_at: t.created_at,
  }));
}

export async function loadMyTopups(): Promise<WalletTopup[]> {
  const { data, error } = await supabase
    .from("wallet_topups")
    .select("id, amount_ht, mode, reference, status, decision_note, created_at")
    .order("id", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return ((data as any[]) ?? []).map((t) => ({
    id: Number(t.id),
    amount_ht: n(t.amount_ht),
    mode: t.mode,
    reference: t.reference ?? null,
    status: t.status,
    decision_note: t.decision_note ?? null,
    created_at: t.created_at,
  }));
}

export async function requestTopup(amount: number, mode: string, reference?: string): Promise<void> {
  const { error } = await supabase.rpc("request_topup", {
    p_amount: amount,
    p_mode: mode,
    p_reference: reference ?? null,
  });
  if (error) throw new Error(error.message);
}
