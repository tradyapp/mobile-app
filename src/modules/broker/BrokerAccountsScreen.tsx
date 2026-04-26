"use client";
import { useEffect, useState } from "react";
import { Block, BlockTitle, Button, Card, List, ListItem } from "konsta/react";
import AppNavbar from "@/components/AppNavbar";
import { brokerService, type BrokerAccount } from "@/services/BrokerService";
import { useBrokerStore } from "@/stores/brokerStore";
import { formatCurrency, relativeTime } from "./utils";

export default function BrokerAccountsScreen() {
  const accounts = useBrokerStore((s) => s.accounts);
  const setAccounts = useBrokerStore((s) => s.setAccounts);
  const navigate = useBrokerStore((s) => s.navigate);
  const refreshKey = useBrokerStore((s) => s.refreshKey);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBalance, setNewBalance] = useState("100000");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    brokerService
      .listAccounts()
      .then((list) => {
        if (!cancelled) setAccounts(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load accounts");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, setAccounts]);

  const handleCreate = async () => {
    const name = newName.trim();
    const balance = Number(newBalance);
    if (!name) {
      setError("Please enter a name");
      return;
    }
    if (!Number.isFinite(balance) || balance < 0) {
      setError("Please enter a valid balance");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await brokerService.createAccount({ name, balance });
      setAccounts([...accounts, created]);
      setNewName("");
      setNewBalance("100000");
      navigate({ kind: "account-summary", accountId: created.id, tab: "summary" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <AppNavbar title="Trading Accounts" />
      <Block>
        <BlockTitle>Your simulation accounts</BlockTitle>
        {loading && (
          <p className="py-6 text-center text-sm text-zinc-400">Loading accounts...</p>
        )}
        {!loading && accounts.length === 0 && (
          <p className="py-6 text-center text-sm text-zinc-400">
            No accounts yet. Create your first one below.
          </p>
        )}
        {!loading && accounts.length > 0 && (
          <List strongIos insetIos>
            {accounts.map((account: BrokerAccount) => (
              <ListItem
                key={account.id}
                link
                title={account.name}
                after={formatCurrency(account.balance)}
                subtitle={`Created ${relativeTime(account.created_at)}`}
                onClick={() =>
                  navigate({ kind: "account-summary", accountId: account.id, tab: "summary" })
                }
              />
            ))}
          </List>
        )}
      </Block>

      <Block strongIos insetIos>
        <BlockTitle>Create a new account</BlockTitle>
        <div className="flex flex-col gap-3 py-2">
          <label className="text-xs uppercase tracking-wide text-zinc-400">Name</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="My practice account"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
          <label className="text-xs uppercase tracking-wide text-zinc-400">Initial balance (USD)</label>
          <input
            type="number"
            inputMode="decimal"
            value={newBalance}
            onChange={(e) => setNewBalance(e.target.value)}
            min={0}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <Button onClick={handleCreate} disabled={creating} className="mt-2">
            {creating ? "Creating..." : "Create account"}
          </Button>
        </div>
      </Block>

      <Card>
        <p className="text-xs leading-relaxed text-zinc-400">
          These are paper-trading accounts for practice. Orders execute instantly against the
          latest available market price. No real money is involved.
        </p>
      </Card>
    </>
  );
}
