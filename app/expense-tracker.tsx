"use client";

import {
  Camera,
  Check,
  ChevronRight,
  CircleDollarSign,
  FileImage,
  History,
  ImageIcon,
  Landmark,
  Loader2,
  LogOut,
  Paperclip,
  Plus,
  ReceiptText,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

type Tab = "add" | "history" | "proofs";
type EntryType = "expense" | "income";

type Transaction = {
  id: number;
  entryDate: string;
  type: EntryType;
  category: string;
  amountCents: number;
  notes: string;
  createdAt: string;
  receiptId: number | null;
  receiptName: string | null;
  receiptUrl: string | null;
};

type ReceiptRecord = {
  id: number;
  expenseDate: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  objectPath: string;
  receiptUrl: string | null;
  transactionId: number | null;
  transactionAmountCents: number | null;
  transactionCategory: string | null;
};

const expenseCategories = [
  "Alimentație",
  "Transport",
  "Locuință",
  "Facturi",
  "Sănătate",
  "Cumpărături",
  "Educație",
  "Divertisment",
  "Altele",
];

const incomeCategories = [
  "Salariu",
  "Încasare",
  "Vânzare",
  "Cadou",
  "Rambursare",
  "Altele",
];

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(value: string, long = false) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("ro-RO", long
    ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
    : { day: "numeric", month: "short", year: "numeric" }
  ).format(date);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function parseAmount(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
}

function initials(name: string) {
  return name.trim().slice(0, 1).toLocaleUpperCase("ro-RO") || "R";
}

export function ExpenseTracker({
  displayName,
  userId,
  onSignOut,
}: {
  displayName: string;
  userId: string;
  onSignOut: () => void | Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("add");
  const [entryType, setEntryType] = useState<EntryType>("expense");
  const [entryDate, setEntryDate] = useState(localDate);
  const [category, setCategory] = useState(expenseCategories[0]);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [summary, setSummary] = useState({ incomeCents: 0, expenseCents: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    if (!supabase) return;
    try {
      const [transactionResult, receiptResult] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, entry_date, type, category, amount_cents, notes, created_at, receipt_id")
          .order("entry_date", { ascending: false })
          .order("id", { ascending: false })
          .limit(500),
        supabase
          .from("receipts")
          .select("id, expense_date, object_path, original_name, content_type, size_bytes, created_at")
          .order("expense_date", { ascending: false })
          .order("id", { ascending: false })
          .limit(500),
      ]);

      if (transactionResult.error) throw transactionResult.error;
      if (receiptResult.error) throw receiptResult.error;

      const receiptRows = receiptResult.data ?? [];
      const paths = receiptRows.map((receipt) => receipt.object_path);
      const signedUrlByPath = new Map<string, string>();
      if (paths.length) {
        const { data: signedUrls, error } = await supabase.storage
          .from("receipts")
          .createSignedUrls(paths, 60 * 60);
        if (error) throw error;
        signedUrls?.forEach((item, index) => {
          if (item.signedUrl) signedUrlByPath.set(paths[index], item.signedUrl);
        });
      }

      const transactionRows = transactionResult.data ?? [];
      const receiptById = new Map(receiptRows.map((receipt) => [receipt.id, receipt]));
      const transactionByReceiptId = new Map(
        transactionRows
          .filter((transaction) => transaction.receipt_id)
          .map((transaction) => [transaction.receipt_id as number, transaction]),
      );

      const mappedTransactions: Transaction[] = transactionRows.map((transaction) => {
        const receipt = transaction.receipt_id ? receiptById.get(transaction.receipt_id) : null;
        return {
          id: transaction.id,
          entryDate: transaction.entry_date,
          type: transaction.type as EntryType,
          category: transaction.category,
          amountCents: transaction.amount_cents,
          notes: transaction.notes,
          createdAt: transaction.created_at,
          receiptId: transaction.receipt_id,
          receiptName: receipt?.original_name ?? null,
          receiptUrl: receipt ? signedUrlByPath.get(receipt.object_path) ?? null : null,
        };
      });

      const mappedReceipts: ReceiptRecord[] = receiptRows.map((receipt) => {
        const linked = transactionByReceiptId.get(receipt.id);
        return {
          id: receipt.id,
          expenseDate: receipt.expense_date,
          originalName: receipt.original_name,
          contentType: receipt.content_type,
          sizeBytes: receipt.size_bytes,
          createdAt: receipt.created_at,
          objectPath: receipt.object_path,
          receiptUrl: signedUrlByPath.get(receipt.object_path) ?? null,
          transactionId: linked?.id ?? null,
          transactionAmountCents: linked?.amount_cents ?? null,
          transactionCategory: linked?.category ?? null,
        };
      });

      const nextSummary = mappedTransactions.reduce(
        (total, transaction) => {
          if (transaction.type === "income") total.incomeCents += transaction.amountCents;
          else total.expenseCents += transaction.amountCents;
          return total;
        },
        { incomeCents: 0, expenseCents: 0 },
      );

      setTransactions(mappedTransactions);
      setSummary(nextSummary);
      setReceipts(mappedReceipts);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Datele nu au putut fi încărcate.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Încărcarea inițială este intenționată la montarea aplicației client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const previewUrl = useMemo(
    () => receiptFile ? URL.createObjectURL(receiptFile) : null,
    [receiptFile],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const transaction of transactions) {
      const current = groups.get(transaction.entryDate) ?? [];
      current.push(transaction);
      groups.set(transaction.entryDate, current);
    }
    return Array.from(groups.entries());
  }, [transactions]);

  const groupedReceipts = useMemo(() => {
    const groups = new Map<string, ReceiptRecord[]>();
    for (const receipt of receipts) {
      const current = groups.get(receipt.expenseDate) ?? [];
      current.push(receipt);
      groups.set(receipt.expenseDate, current);
    }
    return Array.from(groups.entries());
  }, [receipts]);

  const changeType = (type: EntryType) => {
    setEntryType(type);
    setCategory(type === "expense" ? expenseCategories[0] : incomeCategories[0]);
    if (type === "income") setReceiptFile(null);
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Alege o fotografie a bonului.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Fotografia poate avea cel mult 12 MB.");
      return;
    }
    setReceiptFile(file);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const amountCents = parseAmount(amount);
    if (!amountCents) {
      toast.error("Introdu o sumă mai mare decât zero.");
      return;
    }

    setSaving(true);
    let receiptId: number | null = null;
    let receiptPath: string | null = null;
    try {
      if (entryType === "expense" && receiptFile) {
        const extension = receiptFile.name.split(".").pop()?.toLowerCase() || "jpg";
        receiptPath = `${userId}/${entryDate}/${crypto.randomUUID()}.${extension}`;
        const uploaded = await supabase.storage.from("receipts").upload(receiptPath, receiptFile, {
          contentType: receiptFile.type,
          upsert: false,
        });
        if (uploaded.error) throw uploaded.error;

        const receiptInsert = await supabase
          .from("receipts")
          .insert({
            user_id: userId,
            expense_date: entryDate,
            object_path: receiptPath,
            original_name: receiptFile.name || `bon-${entryDate}.${extension}`,
            content_type: receiptFile.type,
            size_bytes: receiptFile.size,
          })
          .select("id")
          .single();
        if (receiptInsert.error) throw receiptInsert.error;
        receiptId = receiptInsert.data.id;
      }

      const transactionInsert = await supabase.from("transactions").insert({
        user_id: userId,
        entry_date: entryDate,
        type: entryType,
        category,
        amount_cents: amountCents,
        notes: notes.trim(),
        receipt_id: receiptId,
      });
      if (transactionInsert.error) throw transactionInsert.error;

      await loadData();
      setAmount("");
      setNotes("");
      setReceiptFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTab("history");
      toast.success(entryType === "expense" ? "Cheltuiala a fost salvată." : "Venitul a fost salvat.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Înregistrarea nu a putut fi salvată.");
      if (receiptId) await supabase.from("receipts").delete().eq("id", receiptId);
      if (receiptPath) await supabase.storage.from("receipts").remove([receiptPath]);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const deleteTransaction = async (transaction: Transaction) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", transaction.id);
      if (error) throw error;
      await loadData();
      toast.success("Înregistrarea a fost ștearsă.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nu am putut șterge înregistrarea.");
    }
  };

  const deleteReceipt = async (receipt: ReceiptRecord) => {
    if (!supabase) return;
    try {
      const { error: storageError } = await supabase.storage.from("receipts").remove([receipt.objectPath]);
      if (storageError) throw storageError;
      const { error: recordError } = await supabase.from("receipts").delete().eq("id", receipt.id);
      if (recordError) throw recordError;
      await loadData();
      toast.success("Fotografia a fost ștearsă.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nu am putut șterge fotografia.");
    }
  };

  const balance = summary.incomeCents - summary.expenseCents;

  return (
    <div className="min-h-dvh bg-[#f4efe5] pb-24 text-[#17312d] sm:pb-10">
      <Toaster position="top-center" richColors />

      <header className="border-b border-[#d9d1c3] bg-[#f9f5ec]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-[#173b35] text-[#fffaf0] shadow-sm">
              <ReceiptText className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a6f57]">Registrul meu</p>
              <h1 className="text-lg font-extrabold tracking-tight sm:text-xl">Bună, {displayName}</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d8d0c1] bg-white px-3 text-sm font-semibold text-[#5b554b] transition hover:border-[#173b35] hover:text-[#173b35]"
          >
            <span className="grid size-6 place-items-center rounded-full bg-[#e5eee8] text-xs font-bold sm:hidden">{initials(displayName)}</span>
            <LogOut className="hidden size-4 sm:block" />
            <span className="hidden sm:inline">Ieșire</span>
          </button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="block">
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <section className="mb-5 grid grid-cols-3 gap-2 sm:mb-7 sm:gap-4" aria-label="Rezumat financiar">
          <SummaryCard
            label="Venituri"
            value={formatMoney(summary.incomeCents)}
            icon={<TrendingUp />}
            color="green"
          />
          <SummaryCard
            label="Cheltuieli"
            value={formatMoney(summary.expenseCents)}
            icon={<TrendingDown />}
            color="orange"
          />
          <SummaryCard
            label="Sold"
            value={formatMoney(balance)}
            icon={<WalletCards />}
            color="blue"
          />
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="hidden rounded-[24px] border border-[#d9d1c3] bg-[#fbf8f1] p-3 shadow-[0_14px_35px_rgba(57,45,30,0.07)] lg:block">
            <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-[0.14em] text-[#917861]">Meniu</p>
            <DesktopNav receiptCount={receipts.length} />
            <div className="mx-2 mt-5 rounded-2xl bg-[#e4ede6] p-4">
              <ShieldCheck className="mb-3 size-5 text-[#286354]" />
              <p className="text-sm font-bold">Date private</p>
              <p className="mt-1 text-xs leading-relaxed text-[#5f6d67]">Înregistrările și fotografiile tale apar doar după autentificare.</p>
            </div>
          </aside>

          <section className="min-w-0">
            <TabsContent value="add" className="mt-0">
              <EntryForm
                entryType={entryType}
                entryDate={entryDate}
                category={category}
                amount={amount}
                notes={notes}
                receiptFile={receiptFile}
                previewUrl={previewUrl}
                saving={saving}
                fileInputRef={fileInputRef}
                onTypeChange={changeType}
                onDateChange={setEntryDate}
                onCategoryChange={setCategory}
                onAmountChange={setAmount}
                onNotesChange={setNotes}
                onFile={handleFile}
                onRemoveFile={() => setReceiptFile(null)}
                onSubmit={handleSubmit}
              />
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <HistoryPanel
                loading={loading}
                groups={groupedTransactions}
                onAdd={() => setTab("add")}
                onDelete={deleteTransaction}
              />
            </TabsContent>

            <TabsContent value="proofs" className="mt-0">
              <ReceiptsPanel
                loading={loading}
                groups={groupedReceipts}
                onAdd={() => setTab("add")}
                onDelete={deleteReceipt}
              />
            </TabsContent>
          </section>
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d9d1c3] bg-[#fffaf2]/95 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden" aria-label="Navigare principală">
        <TabsList className="mx-auto grid h-auto w-full max-w-md grid-cols-3 gap-1 bg-transparent p-0">
          <MobileNavButton value="add" icon={<Plus />} label="Adaugă" />
          <MobileNavButton value="history" icon={<History />} label="Istoric" />
          <MobileNavButton value="proofs" icon={<FileImage />} label="Dovezi" />
        </TabsList>
      </nav>
      </Tabs>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "green" | "orange" | "blue";
}) {
  const styles = {
    green: "border-[#b9d3c5] bg-[#dfece4] text-[#1f594a]",
    orange: "border-[#e7c2ad] bg-[#f4dfd2] text-[#8c4223]",
    blue: "border-[#bdd1db] bg-[#dce9ee] text-[#235365]",
  }[color];
  return (
    <div className={`min-w-0 rounded-2xl border p-3 sm:rounded-[22px] sm:p-5 ${styles}`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-bold sm:text-sm">
        <span className="hidden [&_svg]:size-4 sm:inline-flex">{icon}</span>
        {label}
      </div>
      <p className="truncate text-sm font-black tabular-nums tracking-tight sm:text-2xl">{value}</p>
    </div>
  );
}

function DesktopNav({ receiptCount }: { receiptCount: number }) {
  return (
    <TabsList className="flex h-auto w-full flex-col items-stretch gap-1 bg-transparent p-0">
      <SideButton value="add" icon={<Plus />} label="Adaugă" />
      <SideButton value="history" icon={<History />} label="Istoric" />
      <SideButton value="proofs" icon={<FileImage />} label="Dovezi" badge={receiptCount} />
    </TabsList>
  );
}

function SideButton({ value, icon, label, badge }: { value: Tab; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <TabsTrigger
      value={value}
      className="flex min-h-12 w-full flex-none items-center justify-start gap-3 rounded-2xl px-3 text-sm font-bold text-[#625b50] after:hidden hover:bg-[#eee7da] data-[state=active]:bg-[#173b35] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:[&_.nav-badge]:bg-white/15 data-[state=active]:[&_.nav-badge]:text-white"
    >
      <span className="[&_svg]:size-4">{icon}</span>
      <span>{label}</span>
      {badge !== undefined && <span className="nav-badge ml-auto rounded-full bg-[#ded5c6] px-2 py-0.5 text-xs">{badge}</span>}
    </TabsTrigger>
  );
}

function MobileNavButton({ value, icon, label }: { value: Tab; icon: React.ReactNode; label: string }) {
  return (
    <TabsTrigger
      value={value}
      className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold text-[#71685c] after:hidden data-[state=active]:bg-[#173b35] data-[state=active]:text-white"
    >
      <span className="[&_svg]:size-5">{icon}</span>
      {label}
    </TabsTrigger>
  );
}

function EntryForm({
  entryType,
  entryDate,
  category,
  amount,
  notes,
  receiptFile,
  previewUrl,
  saving,
  fileInputRef,
  onTypeChange,
  onDateChange,
  onCategoryChange,
  onAmountChange,
  onNotesChange,
  onFile,
  onRemoveFile,
  onSubmit,
}: {
  entryType: EntryType;
  entryDate: string;
  category: string;
  amount: string;
  notes: string;
  receiptFile: File | null;
  previewUrl: string | null;
  saving: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onTypeChange: (type: EntryType) => void;
  onDateChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onFile: (file: File | null) => void;
  onRemoveFile: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const categories = entryType === "expense" ? expenseCategories : incomeCategories;
  return (
    <form onSubmit={onSubmit} className="overflow-hidden rounded-[26px] border border-[#d9d1c3] bg-[#fffdf8] shadow-[0_18px_45px_rgba(57,45,30,0.08)]">
      <div className="border-b border-[#e4ddd1] px-5 py-5 sm:px-7 sm:py-6">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#96775e]">Înregistrare nouă</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Ce notezi astăzi?</h2>
        <p className="mt-1 text-sm text-[#746c61]">Datele se sincronizează automat pe dispozitivele tale.</p>
      </div>

      <div className="space-y-6 p-5 sm:p-7">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#eee8dc] p-1.5" role="group" aria-label="Tipul înregistrării">
          <button
            type="button"
            onClick={() => onTypeChange("expense")}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition ${entryType === "expense" ? "bg-[#b8522c] text-white shadow-sm" : "text-[#746b5e]"}`}
          >
            <TrendingDown className="size-4" /> Cheltuială
          </button>
          <button
            type="button"
            onClick={() => onTypeChange("income")}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition ${entryType === "income" ? "bg-[#286354] text-white shadow-sm" : "text-[#746b5e]"}`}
          >
            <TrendingUp className="size-4" /> Venit
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Data" color="yellow">
            <Input
              type="date"
              aria-label="Data"
              value={entryDate}
              max="2100-12-31"
              required
              onChange={(event) => onDateChange(event.target.value)}
              className="h-12 rounded-xl border-[#d7cbb7] bg-white text-base font-semibold shadow-none"
            />
          </Field>
          <Field label="Categorie" color="blue">
            <div className="[&_[data-slot=native-select-wrapper]]:w-full">
              <NativeSelect
                aria-label="Categorie"
                value={category}
                onChange={(event) => onCategoryChange(event.target.value)}
                className="h-12 rounded-xl border-[#c3d5dc] bg-white text-base font-semibold shadow-none"
              >
                {categories.map((item) => <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>)}
              </NativeSelect>
            </div>
          </Field>
        </div>

        <Field label="Sumă" color={entryType === "expense" ? "orange" : "green"}>
          <div className="relative">
            <CircleDollarSign className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#87786a]" />
            <Input
              aria-label="Sumă"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              placeholder="0,00"
              required
              className="h-16 rounded-2xl border-[#d8cbbb] bg-white pl-12 pr-16 text-2xl font-black tabular-nums shadow-none placeholder:font-semibold placeholder:text-[#c4b9aa]"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#87786a]">lei</span>
          </div>
        </Field>

        <Field label="Observații" color="cream" optional>
          <Textarea
            aria-label="Observații"
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="De exemplu: cumpărături pentru casă"
            maxLength={500}
            className="min-h-24 resize-none rounded-2xl border-[#d9d1c3] bg-white px-4 py-3 text-base shadow-none"
          />
        </Field>

        {entryType === "expense" && (
          <Field label="Bon / dovadă" color="purple" optional>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => onFile(event.target.files?.[0] ?? null)}
            />
            {receiptFile && previewUrl ? (
              <div className="overflow-hidden rounded-2xl border border-[#cfc4d7] bg-[#f5eff7]">
                <div className="relative aspect-[16/9] max-h-72 w-full bg-[#e8e0ec]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Previzualizarea bonului" className="h-full w-full object-contain" />
                  <button
                    type="button"
                    onClick={onRemoveFile}
                    className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-[#2e2926]/80 text-white shadow-lg"
                    aria-label="Elimină fotografia"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#6e4c7b]"><Check className="size-4" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{receiptFile.name || "Fotografie bon"}</p>
                    <p className="text-xs text-[#776c79]">Se arhivează la {formatDate(entryDate)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group flex min-h-32 w-full items-center gap-4 rounded-2xl border-2 border-dashed border-[#c8b7d0] bg-[#f7f1f8] p-4 text-left transition hover:border-[#795285] hover:bg-[#f1e8f3]"
              >
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#73507f] text-white shadow-sm transition group-hover:scale-105">
                  <Camera className="size-6" />
                </span>
                <span>
                  <span className="block font-extrabold text-[#55385f]">Fotografiază bonul</span>
                  <span className="mt-1 block text-sm leading-snug text-[#7e6c82]">Camera telefonului se deschide direct. Poți alege și o poză existentă.</span>
                </span>
                <ChevronRight className="ml-auto hidden size-5 text-[#826f88] sm:block" />
              </button>
            )}
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[#786f65]"><ShieldCheck className="size-3.5" /> Fotografia rămâne privată și este organizată după dată.</p>
          </Field>
        )}

        <Button
          type="submit"
          disabled={saving}
          className={`h-14 w-full rounded-2xl text-base font-extrabold shadow-sm ${entryType === "expense" ? "bg-[#b8522c] hover:bg-[#9d4322]" : "bg-[#286354] hover:bg-[#204f44]"}`}
        >
          {saving ? <><Loader2 className="size-5 animate-spin" /> Se salvează…</> : <><Check className="size-5" /> Salvează {entryType === "expense" ? "cheltuiala" : "venitul"}</>}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, optional, color, children }: { label: string; optional?: boolean; color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    yellow: "bg-[#ead9a8] text-[#6a5420]",
    blue: "bg-[#cfe3ea] text-[#315866]",
    orange: "bg-[#f0cbb9] text-[#7c3d23]",
    green: "bg-[#cce0d3] text-[#245446]",
    cream: "bg-[#e8dfd0] text-[#625849]",
    purple: "bg-[#ded0e4] text-[#5c3c67]",
  };
  return (
    <div className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-extrabold">
        <span className={`rounded-full px-3 py-1 ${colors[color]}`}>{label}</span>
        {optional && <span className="text-xs font-medium text-[#948a7d]">opțional</span>}
      </span>
      {children}
    </div>
  );
}

function PanelHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#e4ddd1] px-5 py-5 sm:px-7 sm:py-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#96775e]">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{title}</h2>
        <p className="mt-1 text-sm text-[#746c61]">{description}</p>
      </div>
      {action}
    </div>
  );
}

function HistoryPanel({ loading, groups, onAdd, onDelete }: { loading: boolean; groups: Array<[string, Transaction[]]>; onAdd: () => void; onDelete: (transaction: Transaction) => void }) {
  return (
    <div className="overflow-hidden rounded-[26px] border border-[#d9d1c3] bg-[#fffdf8] shadow-[0_18px_45px_rgba(57,45,30,0.08)]">
      <PanelHeader
        eyebrow="Registru"
        title="Istoric"
        description="Veniturile și cheltuielile tale, grupate pe zile."
        action={<Button type="button" onClick={onAdd} className="hidden h-11 rounded-xl bg-[#173b35] sm:inline-flex"><Plus /> Adaugă</Button>}
      />
      <div className="p-4 sm:p-6">
        {loading ? <LoadingRows /> : groups.length === 0 ? (
          <EmptyState icon={<Landmark />} title="Registrul este gol" text="Adaugă prima înregistrare și va apărea aici." actionLabel="Adaugă acum" onAction={onAdd} />
        ) : (
          <div className="space-y-7">
            {groups.map(([date, items]) => (
              <section key={date}>
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <h3 className="text-sm font-extrabold capitalize text-[#554e45]">{formatDate(date, true)}</h3>
                  <span className="rounded-full bg-[#eee7da] px-2.5 py-1 text-xs font-bold text-[#786d60]">{items.length} {items.length === 1 ? "înregistrare" : "înregistrări"}</span>
                </div>
                <div className="space-y-2">
                  {items.map((transaction) => (
                    <article key={transaction.id} className="group flex items-center gap-3 rounded-2xl border border-[#e1d9cc] bg-white p-3.5 sm:p-4">
                      <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${transaction.type === "expense" ? "bg-[#f3d8ca] text-[#9a4524]" : "bg-[#d7e8dd] text-[#286354]"}`}>
                        {transaction.type === "expense" ? <TrendingDown className="size-5" /> : <TrendingUp className="size-5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-extrabold sm:text-base">{transaction.category}</p>
                            <p className="truncate text-xs text-[#81776b] sm:text-sm">{transaction.notes || (transaction.type === "expense" ? "Cheltuială" : "Venit")}</p>
                          </div>
                          <p className={`whitespace-nowrap text-sm font-black tabular-nums sm:text-base ${transaction.type === "expense" ? "text-[#a34725]" : "text-[#286354]"}`}>
                            {transaction.type === "expense" ? "−" : "+"}{formatMoney(transaction.amountCents)}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          {transaction.receiptUrl && (
                            <a href={transaction.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#eee5f1] px-2 py-1 text-xs font-bold text-[#65466f] hover:bg-[#e5d7e9]">
                              <Paperclip className="size-3" /> Bon
                            </a>
                          )}
                          <span className="ml-auto">
                            <DeleteButton
                              label="Șterge înregistrarea"
                              title="Ștergi această înregistrare?"
                              description="Venitul sau cheltuiala va fi eliminată. Bonul atașat va rămâne în arhiva de dovezi."
                              onConfirm={() => onDelete(transaction)}
                            />
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReceiptsPanel({ loading, groups, onAdd, onDelete }: { loading: boolean; groups: Array<[string, ReceiptRecord[]]>; onAdd: () => void; onDelete: (receipt: ReceiptRecord) => void }) {
  return (
    <div className="overflow-hidden rounded-[26px] border border-[#d9d1c3] bg-[#fffdf8] shadow-[0_18px_45px_rgba(57,45,30,0.08)]">
      <PanelHeader
        eyebrow="Arhivă privată"
        title="Dovezi de cheltuială"
        description="Fotografiile bonurilor, organizate automat pe zile."
        action={<Button type="button" onClick={onAdd} className="hidden h-11 rounded-xl bg-[#73507f] hover:bg-[#60436a] sm:inline-flex"><Plus /> Adaugă cu bon</Button>}
      />
      <div className="p-4 sm:p-6">
        <div className="mb-5 flex gap-3 rounded-2xl border border-[#c9d9cf] bg-[#e6efe9] p-4 text-[#31594e]">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm leading-relaxed"><strong>Arhivă protejată.</strong> Bonurile sunt accesibile doar din contul tău și fiecare fotografie este păstrată la data aleasă.</p>
        </div>
        {loading ? <LoadingRows /> : groups.length === 0 ? (
          <EmptyState icon={<ImageIcon />} title="Nu ai dovezi salvate" text="Fotografiază un bon când adaugi următoarea cheltuială." actionLabel="Adaugă cheltuială cu bon" onAction={onAdd} />
        ) : (
          <div className="space-y-8">
            {groups.map(([date, items]) => (
              <section key={date}>
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className="grid size-8 place-items-center rounded-xl bg-[#eadfac] text-[#725c24]"><ReceiptText className="size-4" /></span>
                  <h3 className="text-sm font-extrabold capitalize text-[#554e45]">{formatDate(date, true)}</h3>
                  <span className="ml-auto rounded-full bg-[#eee7da] px-2.5 py-1 text-xs font-bold text-[#786d60]">{items.length}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((receipt) => (
                    <article key={receipt.id} className="overflow-hidden rounded-2xl border border-[#ddd3c5] bg-white">
                      <a href={receipt.receiptUrl ?? undefined} target="_blank" rel="noreferrer" className="block aspect-[4/3] bg-[#eee9e0]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {receipt.receiptUrl ? <img src={receipt.receiptUrl} alt={`Bon din ${formatDate(receipt.expenseDate)}`} loading="lazy" className="h-full w-full object-cover transition hover:scale-[1.02]" /> : <span className="grid h-full place-items-center text-sm font-bold text-[#81776b]">Imagine indisponibilă</span>}
                      </a>
                      <div className="p-3.5">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-extrabold">{receipt.transactionCategory ?? "Bon arhivat"}</p>
                            <p className="mt-0.5 text-xs text-[#81776b]">{receipt.transactionAmountCents ? formatMoney(receipt.transactionAmountCents) : "Fără cheltuială asociată"}</p>
                          </div>
                          <DeleteButton
                            label="Șterge fotografia"
                            title="Ștergi definitiv fotografia?"
                            description="Dovada va fi eliminată din arhivă și nu va mai putea fi recuperată."
                            onConfirm={() => onDelete(receipt)}
                          />
                        </div>
                        <a href={receipt.receiptUrl ?? undefined} target="_blank" rel="noreferrer" aria-disabled={!receipt.receiptUrl} className="mt-3 flex min-h-9 items-center justify-center gap-2 rounded-xl bg-[#f0e7f2] text-xs font-extrabold text-[#62446c] hover:bg-[#e7d9eb] aria-disabled:pointer-events-none aria-disabled:opacity-50">
                          <ImageIcon className="size-3.5" /> Deschide dovada
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, text, actionLabel, onAction }: { icon: React.ReactNode; title: string; text: string; actionLabel: string; onAction: () => void }) {
  return (
    <Empty className="min-h-72 rounded-2xl border-2 border-[#ddd4c7] bg-[#faf7f0]">
      <EmptyHeader>
        <EmptyMedia className="grid size-14 place-items-center rounded-2xl bg-[#e7eee8] text-[#356557] [&_svg]:size-6">{icon}</EmptyMedia>
        <EmptyTitle className="font-black">{title}</EmptyTitle>
        <EmptyDescription className="text-[#7b7267]">{text}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" onClick={onAction} className="h-11 rounded-xl bg-[#173b35]"><Plus /> {actionLabel}</Button>
      </EmptyContent>
    </Empty>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3" aria-label="Se încarcă">
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex animate-pulse items-center gap-3 rounded-2xl border border-[#e4ddd1] bg-white p-4">
          <Skeleton className="size-11 rounded-2xl bg-[#e9e3d8]" />
          <span className="flex-1 space-y-2"><Skeleton className="h-3 w-1/3 bg-[#e9e3d8]" /><Skeleton className="h-2.5 w-1/2 bg-[#eee9e0]" /></span>
          <Skeleton className="h-4 w-20 bg-[#e9e3d8]" />
        </div>
      ))}
    </div>
  );
}

function DeleteButton({ label, title, description, onConfirm }: { label: string; title: string; description: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button type="button" className="grid size-8 shrink-0 place-items-center rounded-lg text-[#9b9184] hover:bg-[#f7e2dc] hover:text-[#a33f25]" aria-label={label}>
          <Trash2 className="size-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl border-[#d9d1c3] bg-[#fffdf8]">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Renunță</AlertDialogCancel>
          <AlertDialogAction variant="destructive" className="rounded-xl" onClick={onConfirm}>Șterge</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
