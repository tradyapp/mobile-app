"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Block, BlockTitle, Button, List, ListInput, ListItem } from "konsta/react";
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
    <button
      onClick={() => {
        if (option === "menu") {
          goBack();
          return;
        }
        navigate({ kind: "settings", accountId, option: "menu" });
      }}
      className="ml-2 flex items-center gap-1 text-sm text-emerald-400"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      {option === "menu" ? "Back" : "Settings"}
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

  const title =
    option === "rename"
      ? "Change Name"
      : option === "deposit"
        ? "Deposit Funds"
        : option === "withdraw"
          ? "Withdraw Funds"
          : option === "delete"
            ? "Delete Account"
            : `${account.name} • Settings`;

  return (
    <>
      <AppNavbar title={title} left={navbarLeft} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={option}
          initial={{ x: option === "menu" ? -24 : 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: option === "menu" ? 24 : -24, opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {option === "menu" && (
            <SettingsMenu
              account={account}
              onOpen={(next) => navigate({ kind: "settings", accountId, option: next })}
            />
          )}

          {option === "rename" && (
            <RenameForm
              account={account}
              onUpdated={refreshAccount}
              onCancel={() => navigate({ kind: "settings", accountId, option: "menu" })}
            />
          )}

          {option === "deposit" && (
            <AmountForm
              title="Add funds to this simulation account."
              actionLabel="Deposit"
              onSubmit={(amount) => brokerService.fundAccount(accountId, amount)}
              onUpdated={refreshAccount}
              onCancel={() => navigate({ kind: "settings", accountId, option: "menu" })}
            />
          )}

          {option === "withdraw" && (
            <AmountForm
              title="Move cash out of this simulation account."
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
        </motion.div>
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------

function SettingsMenu({
  account,
  onOpen,
}: {
  account: BrokerAccount;
  onOpen: (option: Exclude<BrokerSettingsOption, "menu">) => void;
}) {
  return (
    <>
      <Block className="mb-2">
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/90 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Account Overview</div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-2xl font-semibold text-white">{account.name}</div>
              <div className="mt-1 text-sm text-zinc-400">Paper trading account settings</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Cash</div>
              <div className="mt-1 text-lg font-medium text-zinc-100">{formatCurrency(account.balance)}</div>
            </div>
          </div>
        </div>
      </Block>

      <Block>
        <BlockTitle>Account settings</BlockTitle>
        <List strongIos insetIos>
          <ListItem
            link
            title="Change name"
            after={account.name}
            onClick={() => onOpen("rename")}
          />
          <ListItem
            link
            title="Make a deposit"
            after={formatCurrency(account.balance)}
            onClick={() => onOpen("deposit")}
          />
          <ListItem
            link
            title="Withdraw funds"
            onClick={() => onOpen("withdraw")}
          />
        </List>
      </Block>

      <Block>
        <BlockTitle>Danger zone</BlockTitle>
        <List strongIos insetIos>
          <ListItem
            link
            title="Delete account"
            titleWrapClassName="text-rose-400"
            onClick={() => onOpen("delete")}
          />
        </List>
      </Block>
    </>
  );
}

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
    <>
      <Block className="mb-2">
        <p className="text-sm text-zinc-400">
          Update the label used across Trade for this simulation account.
        </p>
      </Block>
      <List strongIos insetIos>
        <ListInput
          label="Account name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
          inputClassName="text-base text-white"
        />
      </List>
      {error && (
        <Block>
          <p className="text-sm text-rose-400">{error}</p>
        </Block>
      )}
      <Block>
        <div className="flex gap-2">
          <Button onClick={handle} disabled={busy} className="flex-1">
            {busy ? "Saving..." : "Save"}
          </Button>
          <Button outline onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </Block>
    </>
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
    <>
      <Block className="mb-2">
        <p className="text-sm text-zinc-400">{title}</p>
      </Block>
      <List strongIos insetIos>
        <ListInput
          label="Amount in USD"
          type="number"
          inputMode="decimal"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          inputClassName="text-base text-white"
        />
      </List>
      {maxAmount !== undefined && (
        <Block>
          <p className="text-xs text-zinc-500">Available: {formatCurrency(maxAmount)}</p>
        </Block>
      )}
      {error && (
        <Block>
          <p className="text-sm text-rose-400">{error}</p>
        </Block>
      )}
      <Block>
        <div className="flex gap-2">
          <Button onClick={handle} disabled={busy} className="flex-1">
            {busy ? "Working..." : actionLabel}
          </Button>
          <Button outline onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </Block>
    </>
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
  const selectAccount = useBrokerStore((s) => s.selectAccount);
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
      const remainingAccounts = accounts.filter((a) => a.id !== accountId);
      setAccounts(remainingAccounts);
      selectAccount(remainingAccounts[0]?.id ?? null);
      bumpRefresh();
      navigate({ kind: "accounts" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setBusy(false);
    }
  };

  return (
    <>
      <Block className="mb-2">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
          This permanently deletes <strong>{name}</strong>, including all orders, positions and
          transactions. This action cannot be undone.
        </div>
      </Block>
      <List strongIos insetIos>
        <ListInput
          label="Type account name to confirm"
          type="text"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder={name}
          inputClassName="text-base text-white"
        />
      </List>
      {error && (
        <Block>
          <p className="text-sm text-rose-400">{error}</p>
        </Block>
      )}
      <Block>
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
      </Block>
    </>
  );
}
