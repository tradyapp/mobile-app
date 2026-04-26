"use client";
import { useEffect, useState } from "react";
import { Block, BlockTitle, Button, List, ListItem } from "konsta/react";
import AppNavbar from "@/components/AppNavbar";
import { brokerService, type BrokerAccount } from "@/services/BrokerService";
import { useBrokerStore, type BrokerSettingsOption } from "@/stores/brokerStore";
import { formatCurrency } from "./utils";

interface Props {
  accountId: string;
  option: BrokerSettingsOption;
}

export default function BrokerSettingsScreen({ accountId, option }: Props) {
  const navigate = useBrokerStore((s) => s.navigate);
  const goBack = useBrokerStore((s) => s.goBack);
  const bumpRefresh = useBrokerStore((s) => s.bumpRefresh);
  const setAccounts = useBrokerStore((s) => s.setAccounts);
  const accounts = useBrokerStore((s) => s.accounts);
  const refreshKey = useBrokerStore((s) => s.refreshKey);

  const [account, setAccount] = useState<BrokerAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    brokerService
      .getAccount(accountId)
      .then((acc) => {
        if (!cancelled) setAccount(acc);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load account");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, refreshKey]);

  const navbarLeft = (
    <button onClick={goBack} className="ml-2 flex items-center gap-1 text-sm text-emerald-400">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  );

  if (loading) {
    return (
      <>
        <AppNavbar title="Settings" left={navbarLeft} />
        <Block>
          <p className="py-6 text-center text-sm text-zinc-400">Loading...</p>
        </Block>
      </>
    );
  }

  if (!account) {
    return (
      <>
        <AppNavbar title="Settings" left={navbarLeft} />
        <Block>
          <p className="py-6 text-center text-sm text-rose-400">{error ?? "Account not found"}</p>
        </Block>
      </>
    );
  }

  const refreshAccount = (updated: BrokerAccount) => {
    setAccount(updated);
    setAccounts(accounts.map((a) => (a.id === updated.id ? updated : a)));
    bumpRefresh();
  };

  return (
    <>
      <AppNavbar title={`${account.name} • Settings`} left={navbarLeft} />

      {option === "menu" && (
        <Block strongIos insetIos>
          <BlockTitle>Account settings</BlockTitle>
          <List strongIos insetIos>
            <ListItem
              link
              title="Change name"
              after={account.name}
              onClick={() => navigate({ kind: "settings", accountId, option: "rename" })}
            />
            <ListItem
              link
              title="Make a deposit"
              after={formatCurrency(account.balance)}
              onClick={() => navigate({ kind: "settings", accountId, option: "deposit" })}
            />
            <ListItem
              link
              title="Withdraw"
              onClick={() => navigate({ kind: "settings", accountId, option: "withdraw" })}
            />
            <ListItem
              link
              title="Delete account"
              titleWrapClassName="text-rose-400"
              onClick={() => navigate({ kind: "settings", accountId, option: "delete" })}
            />
          </List>
        </Block>
      )}

      {option === "rename" && (
        <RenameForm account={account} onUpdated={refreshAccount} onCancel={() => navigate({ kind: "settings", accountId, option: "menu" })} />
      )}

      {option === "deposit" && (
        <AmountForm
          title="Deposit funds"
          actionLabel="Deposit"
          onSubmit={(amount) => brokerService.fundAccount(accountId, amount)}
          onUpdated={refreshAccount}
          onCancel={() => navigate({ kind: "settings", accountId, option: "menu" })}
        />
      )}

      {option === "withdraw" && (
        <AmountForm
          title="Withdraw funds"
          actionLabel="Withdraw"
          maxAmount={Number(account.balance)}
          onSubmit={(amount) => brokerService.withdrawAccount(accountId, amount)}
          onUpdated={refreshAccount}
          onCancel={() => navigate({ kind: "settings", accountId, option: "menu" })}
        />
      )}

      {option === "delete" && (
        <DeleteForm
          accountId={accountId}
          name={account.name}
          onCancel={() => navigate({ kind: "settings", accountId, option: "menu" })}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function RenameForm({
  account,
  onUpdated,
  onCancel,
}: {
  account: BrokerAccount;
  onUpdated: (a: BrokerAccount) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(account.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await brokerService.renameAccount(account.id, name.trim());
      onUpdated(updated);
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Block strongIos insetIos>
      <BlockTitle>Change account name</BlockTitle>
      <div className="flex flex-col gap-3 py-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={handle} disabled={busy} className="flex-1">
            {busy ? "Saving..." : "Save"}
          </Button>
          <Button outline onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </Block>
  );
}

function AmountForm({
  title,
  actionLabel,
  maxAmount,
  onSubmit,
  onUpdated,
  onCancel,
}: {
  title: string;
  actionLabel: string;
  maxAmount?: number;
  onSubmit: (amount: number) => Promise<BrokerAccount>;
  onUpdated: (a: BrokerAccount) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a positive amount");
      return;
    }
    if (maxAmount !== undefined && value > maxAmount) {
      setError(`Cannot exceed ${formatCurrency(maxAmount)}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await onSubmit(value);
      onUpdated(updated);
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Block strongIos insetIos>
      <BlockTitle>{title}</BlockTitle>
      <div className="flex flex-col gap-3 py-2">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount in USD"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        />
        {maxAmount !== undefined && (
          <p className="text-xs text-zinc-500">Available: {formatCurrency(maxAmount)}</p>
        )}
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={handle} disabled={busy} className="flex-1">
            {busy ? "Working..." : actionLabel}
          </Button>
          <Button outline onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </Block>
  );
}

function DeleteForm({
  accountId,
  name,
  onCancel,
}: {
  accountId: string;
  name: string;
  onCancel: () => void;
}) {
  const navigate = useBrokerStore((s) => s.navigate);
  const bumpRefresh = useBrokerStore((s) => s.bumpRefresh);
  const setAccounts = useBrokerStore((s) => s.setAccounts);
  const accounts = useBrokerStore((s) => s.accounts);

  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async () => {
    if (confirmName.trim() !== name) {
      setError("Type the account name exactly to confirm");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await brokerService.deleteAccount(accountId);
      setAccounts(accounts.filter((a) => a.id !== accountId));
      bumpRefresh();
      navigate({ kind: "accounts" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setBusy(false);
    }
  };

  return (
    <Block strongIos insetIos>
      <BlockTitle>Delete account</BlockTitle>
      <div className="flex flex-col gap-3 py-2">
        <p className="text-sm text-zinc-300">
          This permanently deletes <strong>{name}</strong>, including all its orders, positions
          and transactions. This cannot be undone.
        </p>
        <p className="text-xs text-zinc-400">Type the account name to confirm:</p>
        <input
          type="text"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder={name}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-rose-500 focus:outline-none"
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex gap-2">
          <Button
            onClick={handle}
            disabled={busy}
            colors={{ fillBgIos: "bg-rose-600", fillBgMaterial: "bg-rose-600" }}
            className="flex-1"
          >
            {busy ? "Deleting..." : "Delete account"}
          </Button>
          <Button outline onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </Block>
  );
}
