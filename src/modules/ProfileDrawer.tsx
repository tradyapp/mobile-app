/* eslint-disable @next/next/no-img-element */
"use client";
import { List, ListItem, ListButton, ListInput, Dialog, DialogButton } from "konsta/react";
import AppDrawer, { type DrawerScreen } from "../components/uiux/AppDrawer";
import { useDrawerNav } from "../components/uiux/drawer-nav";
import { authService } from "@/services/AuthService";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "@/stores/authStore";
import { userService } from "@/services/UserService";
import { useUserPrefsStore } from "@/stores/userPrefsStore";
import { toast } from "sonner";
import Cropper, { type Area, type Point } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { brokerService, type BrokerAccount } from "@/services/BrokerService";
import { formatCurrency, relativeTime } from "@/modules/broker/utils";
import { useBrokerStore } from "@/stores/brokerStore";

// ── Shared context for profile state ──

interface ProfileData {
  displayName: string;
  displayname: string;
  email: string;
  avatarUrl: string | null;
  locale: string;
  timezone: string;
  uid: string;
}

interface TradingAccountData {
  id: string;
  name: string;
  balance: number;
  accountType: "simulation";
  createdAt: string;
}

interface ProfileCtxValue {
  locale: "en" | "es";
  isUpdatingLocale: boolean;
  handleLanguageChange: (nextLocale: "en" | "es") => void;
  setIsLogoutDialogOpen: (open: boolean) => void;
  profile: ProfileData;
  tradingAccounts: TradingAccountData[];
  activeTradingAccountId: string | null;
  selectTradingAccount: (accountId: string) => void;
  updateAvatar: (file: File) => Promise<void>;
  updateProfileNames: (values: { displayName: string; displayname: string }) => Promise<void>;
  addTradingAccount: (values: { name: string; amount: number; accountType: "simulation" }) => Promise<void>;
}

const ProfileCtx = createContext<ProfileCtxValue>(null!);

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });

const getCroppedAvatarFile = async (imageSrc: string, cropPixels: Area): Promise<File> => {
  const image = await loadImage(imageSrc);
  const outputSize = Math.max(1, Math.round(Math.min(cropPixels.width, cropPixels.height)));
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas context is not available");
  }

  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    outputSize,
    outputSize
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Failed to create cropped image"))),
      "image/webp",
      0.92
    );
  });

  return new File([blob], "avatar-cropped.webp", { type: "image/webp" });
};

// ── Screen: Account (root) ──

function AccountScreen() {
  const { navigateTo } = useDrawerNav();
  const {
    locale,
    isUpdatingLocale,
    setIsLogoutDialogOpen,
    profile,
    tradingAccounts,
    activeTradingAccountId,
  } = useContext(ProfileCtx);
  const activeAccount = tradingAccounts.find((account) => account.id === activeTradingAccountId) ?? null;

  return (
    <div>
      <List strong className="mb-6 rounded-xl overflow-hidden">
        <ListItem
          link
          onClick={() => navigateTo("profile")}
          title={
            <div className="flex flex-col">
              <span className="text-base text-zinc-200 font-medium">
                {profile.displayName || "Usuario"}
              </span>
              <span className="text-sm text-zinc-500">
                {profile.email}
              </span>
            </div>
          }
          media={
            <img
              src={profile.avatarUrl || "/img/default-user.webp"}
              alt="Profile"
              className="w-14 h-14 rounded-full object-cover"
            />
          }
        />
        <ListButton>
          <span className="text-zinc-400 w-full flex justify-between">
            <span> Subscription status: </span>
            <span className="text-brand-primary font-medium">Active</span>
          </span>
        </ListButton>
      </List>

      <List strong className="mb-6 rounded-xl overflow-hidden">
        <ListItem
          link
          title="Trading Accounts"
          after={activeAccount ? activeAccount.name : `${tradingAccounts.length}`}
          onClick={() => navigateTo("trading-accounts")}
        />
        <ListItem link title="Subscriptions" />
        <ListItem
          title="Time Zone"
          after={profile.timezone || "—"}
        />
        <ListItem
          link
          title="Language"
          after={isUpdatingLocale ? "Saving..." : locale === "es" ? "Español" : "English"}
          onClick={() => navigateTo("language")}
        />
        <ListItem link title="Contact" />
      </List>

      <List strong className="rounded-xl overflow-hidden">
        <ListButton
          className="k-color-brand-red text-rose-500"
          onClick={() => setIsLogoutDialogOpen(true)}
        >
          Sign Out
        </ListButton>
      </List>
    </div>
  );
}

function TradingAccountsScreen() {
  const { tradingAccounts, activeTradingAccountId, selectTradingAccount, addTradingAccount } = useContext(ProfileCtx);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [accountType, setAccountType] = useState<"simulation">("simulation");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (saving) return;
    const nextName = name.trim();
    const parsedAmount = Number(amount.replace(",", "."));
    if (!nextName) {
      setError("El nombre de la cuenta es obligatorio.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("El monto debe ser mayor a 0.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await addTradingAccount({ name: nextName, amount: parsedAmount, accountType });
      setName("");
      setAmount("");
      setAccountType("simulation");
      setIsCreating(false);
      toast.success("Cuenta creada");
    } catch {
      setError("No se pudo crear la cuenta.");
      toast.error("No se pudo crear la cuenta");
    } finally {
      setSaving(false);
    }
  };

  const getTypeLabel = (type: TradingAccountData["accountType"]) => {
    if (type === "simulation") return "Simulación";
    return type;
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => {
            setIsCreating((prev) => !prev);
            setError(null);
          }}
          className="w-10 h-10 rounded-full text-black text-xl font-semibold flex items-center justify-center"
          style={{ background: "#00ff99" }}
          aria-label="Agregar cuenta"
        >
          +
        </button>
      </div>

      {isCreating && (
        <div className="mb-4 rounded-xl border border-zinc-700 bg-zinc-900 p-3">
          <div className="space-y-2">
            <ListInput
              label="Nombre de la cuenta"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Cuenta Principal"
              inputClassName="text-base text-white"
            />
            <ListInput
              label="Monto"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ej: 1000"
              inputClassName="text-base text-white"
            />
            <div className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2">
              <label className="block text-xs text-zinc-400">Tipo de cuenta</label>
              <div className="relative mt-1">
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as "simulation")}
                  className="w-full appearance-none bg-transparent pr-8 text-base text-zinc-100 focus:outline-none"
                >
                  <option value="simulation">Simulación</option>
                </select>
                <svg
                  className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.1 1.02l-4.25 4.5a.75.75 0 0 1-1.1 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </div>
          {error && <p className="text-rose-400 text-xs mt-2">{error}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                if (saving) return;
                setIsCreating(false);
                setError(null);
              }}
              disabled={saving}
              className="w-full px-4 py-2 rounded-full text-sm font-medium text-zinc-200 border border-zinc-600 disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={() => void handleCreate()}
              disabled={saving}
              className="w-full px-4 py-2 rounded-full text-sm font-medium text-black disabled:opacity-40"
              style={{ background: "#00ff99" }}
            >
              {saving ? "Creando..." : "Crear cuenta"}
            </button>
          </div>
        </div>
      )}

      <List strong className="rounded-xl overflow-hidden">
        {tradingAccounts.length === 0 ? (
          <ListItem title="No tienes cuentas de trading todavía." />
        ) : (
          tradingAccounts.map((item) => (
            <ListItem
              key={item.id}
              link
              title={item.name}
              subtitle={`${formatCurrency(item.balance)} • ${getTypeLabel(item.accountType)} • ${relativeTime(item.createdAt)}`}
              after={activeTradingAccountId === item.id ? "Activa" : undefined}
              onClick={() => selectTradingAccount(item.id)}
            />
          ))
        )}
      </List>
    </div>
  );
}

// ── Screen: Profile ──

function ProfileScreen() {
  const { profile, updateAvatar, updateProfileNames } = useContext(ProfileCtx);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [savingNames, setSavingNames] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropAreaPixels, setCropAreaPixels] = useState<Area | null>(null);
  const [isSavingCrop, setIsSavingCrop] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState(profile.displayName ?? "");
  const [displaynameDraft, setDisplaynameDraft] = useState(profile.displayname ?? "");

  useEffect(() => {
    setDisplayNameDraft(profile.displayName ?? "");
    setDisplaynameDraft(profile.displayname ?? "");
  }, [profile.displayName, profile.displayname]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const imageSrc = await readFileAsDataUrl(file);
      setCropImageSrc(imageSrc);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropAreaPixels(null);
    } catch {
      // silent fail
    }
  };

  const handleCropConfirm = async () => {
    if (!cropImageSrc || !cropAreaPixels || isSavingCrop) return;
    setIsSavingCrop(true);
    setUploading(true);
    try {
      const croppedFile = await getCroppedAvatarFile(cropImageSrc, cropAreaPixels);
      await updateAvatar(croppedFile);
      setCropImageSrc(null);
      setCropAreaPixels(null);
    } catch {
      // silent fail
    } finally {
      setIsSavingCrop(false);
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    if (isSavingCrop) return;
    setCropImageSrc(null);
    setCropAreaPixels(null);
  };

  const handleSaveNames = async () => {
    if (savingNames) return;
    const nextDisplayName = displayNameDraft.trim();
    const nextDisplayname = displaynameDraft;
    if (!nextDisplayName) {
      setNameError("Nombre es obligatorio.");
      return;
    }
    if (!nextDisplayname.trim()) {
      setNameError("Displayname es obligatorio.");
      return;
    }
    setNameError(null);
    setSavingNames(true);
    try {
      await updateProfileNames({ displayName: nextDisplayName, displayname: nextDisplayname });
      toast.success("Cambios guardados");
    } catch {
      setNameError("No se pudo guardar el perfil.");
      toast.error("No se pudo guardar el perfil");
    } finally {
      setSavingNames(false);
    }
  };

  return (
    <div>
      {/* Avatar + upload */}
      <div className="flex flex-col items-center py-6">
        <div className="relative mb-3">
          {uploading ? (
            <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-zinc-600 border-t-[#00ff99] rounded-full animate-spin" />
            </div>
          ) : (
            <img
              src={profile.avatarUrl || "/img/default-user.webp"}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover"
            />
          )}
        </div>
        <h2 className="text-white text-lg font-semibold">
          {profile.displayName || "Usuario"}
        </h2>
        <p className="text-zinc-500 text-sm mb-3">{profile.email}</p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 rounded-full text-sm font-medium text-black disabled:opacity-40 active:opacity-80 transition-opacity"
          style={{ background: "#00ff99" }}
        >
          {uploading ? "Subiendo..." : profile.avatarUrl ? "Cambiar foto" : "Subir foto"}
        </button>
      </div>

      {/* Profile fields */}
      <List strong className="rounded-xl overflow-hidden">
        <ListInput
          label="Nombre"
          type="text"
          value={displayNameDraft}
          onChange={(e) => setDisplayNameDraft(e.target.value)}
          placeholder="Tu nombre"
        />
        <ListInput
          label="Displayname"
          type="text"
          value={displaynameDraft}
          onChange={(e) => setDisplaynameDraft(e.target.value)}
          placeholder="usuario_publico"
        />
        <ListItem
          title={<span className="text-zinc-500 text-sm">Email</span>}
          after={<span className="text-zinc-200 text-sm truncate max-w-[200px]">{profile.email || "—"}</span>}
        />
      </List>
      {nameError && <p className="text-rose-400 text-xs mt-3 px-2">{nameError}</p>}
      <button
        onClick={() => void handleSaveNames()}
        disabled={savingNames}
        className="mt-3 w-full px-4 py-2 rounded-full text-sm font-medium text-black disabled:opacity-40 active:opacity-80 transition-opacity"
        style={{ background: "#00ff99" }}
      >
        {savingNames ? "Guardando..." : "Guardar perfil"}
      </button>

      {cropImageSrc && (
        <div className="fixed inset-0 z-[10001] bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
            <h3 className="text-white text-base font-semibold">Ajusta tu foto</h3>
            <p className="text-zinc-400 text-sm mt-1">Recorta la imagen en formato cuadrado.</p>

            <div className="relative mt-4 h-72 w-full overflow-hidden rounded-xl bg-black">
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, areaPixels) => setCropAreaPixels(areaPixels)}
              />
            </div>

            <div className="mt-4">
              <label htmlFor="profile-avatar-zoom" className="mb-2 block text-sm text-zinc-300">
                Zoom
              </label>
              <input
                id="profile-avatar-zoom"
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-[#00ff99]"
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={handleCropCancel}
                disabled={isSavingCrop}
                className="rounded-xl border border-zinc-600 py-2 text-sm text-zinc-200 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleCropConfirm}
                disabled={isSavingCrop || !cropAreaPixels}
                className="rounded-xl py-2 text-sm font-medium text-black disabled:opacity-40"
                style={{ background: "#00ff99" }}
              >
                {isSavingCrop ? "Guardando..." : "Usar imagen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Screen: Language ──

const LANGUAGES: { code: "en" | "es"; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

function LanguageScreen() {
  const { goBack } = useDrawerNav();
  const { locale, handleLanguageChange } = useContext(ProfileCtx);

  const onSelect = (code: "en" | "es") => {
    handleLanguageChange(code);
    goBack();
  };

  return (
    <List strong className="rounded-xl overflow-hidden">
      {LANGUAGES.map((lang) => (
        <ListItem
          key={lang.code}
          link
          title={lang.label}
          after={locale === lang.code ? "✓" : ""}
          onClick={() => onSelect(lang.code)}
        />
      ))}
    </List>
  );
}

// ── Screen definitions ──

const SCREENS: DrawerScreen[] = [
  { name: "account", title: "Account", component: AccountScreen, isRoot: true },
  { name: "profile", title: "Profile", component: ProfileScreen },
  { name: "trading-accounts", title: "Trading Accounts", component: TradingAccountsScreen },
  { name: "language", title: "Language", component: LanguageScreen },
];

// ── Main component ──

interface ProfileDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileDrawer({
  isOpen,
  onOpenChange,
}: ProfileDrawerProps) {
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [locale, setLocale] = useState<"en" | "es">("en");
  const [isUpdatingLocale, setIsUpdatingLocale] = useState(false);
  const user = useAuthStore((state) => state.user);
  const setStoreLocale = useUserPrefsStore((state) => state.setLocale);
  const [tradingAccounts, setTradingAccounts] = useState<TradingAccountData[]>([]);
  const activeTradingAccountId = useBrokerStore((state) => state.selectedAccountId);
  const setBrokerAccounts = useBrokerStore((state) => state.setAccounts);
  const selectBrokerAccount = useBrokerStore((state) => state.selectAccount);
  const brokerRefreshKey = useBrokerStore((state) => state.refreshKey);
  const [profile, setProfile] = useState<ProfileData>({
    displayName: "",
    displayname: "",
    email: user?.email ?? "",
    avatarUrl: null,
    locale: "es",
    timezone: "America/Bogota",
    uid: user?.uid ?? "",
  });

  useEffect(() => {
    let active = true;

    if (!isOpen || !user?.uid) return;

    const run = async () => {
      try {
        const result = await userService.getUserProfile(user.uid);
        if (!active) return;
        const nextLocale = result.userData.locale === "es" ? "es" : "en";
        setLocale(nextLocale);
        setStoreLocale(nextLocale);
        setProfile({
          displayName: (result.userData.displayName as string) ?? "",
          displayname: (result.userData.displayname as string) ?? "",
          email: user.email ?? "",
          avatarUrl: (result.userData.avatarUrl as string) ?? null,
          locale: (result.userData.locale as string) ?? "es",
          timezone: (result.userData.timezone as string) ?? "America/Bogota",
          uid: user.uid,
        });
      } catch (error) {
        console.error("Error loading profile:", error);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [isOpen, user?.uid, user?.email, setStoreLocale]);

  useEffect(() => {
    let active = true;
    if (!isOpen) return;

    brokerService
      .listAccounts()
      .then((accounts) => {
        if (!active) return;
        const mapped = accounts.map(mapBrokerAccountToTradingAccount);
        setTradingAccounts(mapped);
        setBrokerAccounts(accounts);
      })
      .catch(() => {
        if (!active) return;
        setTradingAccounts([]);
      });

    return () => {
      active = false;
    };
  }, [isOpen, brokerRefreshKey, setBrokerAccounts]);

  const handleLanguageChange = async (nextLocale: "en" | "es") => {
    if (!user?.uid || nextLocale === locale || isUpdatingLocale) return;

    setLocale(nextLocale);
    setStoreLocale(nextLocale);
    setProfile((p) => ({ ...p, locale: nextLocale }));
    setIsUpdatingLocale(true);
    try {
      await userService.updateUserProfile(user.uid, { locale: nextLocale });
    } catch (error) {
      console.error("Error updating language:", error);
    } finally {
      setIsUpdatingLocale(false);
    }
  };

  const updateAvatar = async (file: File) => {
    if (!user?.uid) return;
    const newUrl = await userService.uploadAvatar(user.uid, file);
    setProfile((p) => ({ ...p, avatarUrl: newUrl }));
  };

  const updateProfileNames = async (values: { displayName: string; displayname: string }) => {
    if (!user?.uid) return;
    await userService.updateUserProfile(user.uid, values);
    setProfile((p) => ({ ...p, displayName: values.displayName, displayname: values.displayname }));
  };

  const addTradingAccount = async (values: { name: string; amount: number; accountType: "simulation" }) => {
    const created = await brokerService.createAccount({ name: values.name, balance: values.amount });
    setTradingAccounts((prev) => [mapBrokerAccountToTradingAccount(created), ...prev]);
    setBrokerAccounts([created, ...useBrokerStore.getState().accounts]);
    selectBrokerAccount(created.id);
  };

  const selectTradingAccount = (accountId: string) => {
    selectBrokerAccount(accountId);
  };

  const ctxValue: ProfileCtxValue = {
    locale,
    isUpdatingLocale,
    handleLanguageChange,
    setIsLogoutDialogOpen,
    profile,
    tradingAccounts,
    activeTradingAccountId,
    selectTradingAccount,
    updateAvatar,
    updateProfileNames,
    addTradingAccount,
  };

  return (
    <ProfileCtx.Provider value={ctxValue}>
      <AppDrawer
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        title="Account"
        height="full"
        description="User profile, language, and account settings."
        screens={SCREENS}
      />

      {typeof window !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-9999 pointer-events-none">
            <div className="pointer-events-auto">
              <Dialog
                backdrop
                opened={isLogoutDialogOpen}
                onBackdropClick={(e) => {
                  e?.stopPropagation?.();
                  setIsLogoutDialogOpen(false);
                }}
                title="Sign Out"
                content="Are you sure you want to sign out?"
                buttons={
                  <>
                    <DialogButton
                      onClick={(e) => {
                        e?.stopPropagation?.();
                        setIsLogoutDialogOpen(false);
                      }}
                    >
                      Cancel
                    </DialogButton>
                    <DialogButton
                      strong
                      className="text-black"
                      onClick={(e) => {
                        e?.stopPropagation?.();
                        authService.logout();
                        setIsLogoutDialogOpen(false);
                        onOpenChange(false);
                      }}
                    >
                      Sign Out
                    </DialogButton>
                  </>
                }
              />
            </div>
          </div>,
          document.body
        )}
    </ProfileCtx.Provider>
  );
}

function mapBrokerAccountToTradingAccount(account: BrokerAccount): TradingAccountData {
  return {
    id: account.id,
    name: account.name,
    balance: Number(account.balance),
    accountType: "simulation",
    createdAt: account.created_at,
  };
}
