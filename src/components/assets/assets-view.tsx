"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FolderOpen,
  Folder,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Sparkles,
  Music,
  Film,
  Image as ImageIcon,
  Inbox,
  FolderInput,
  Check,
  Layers,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { ASSET_CLASSES } from "@/lib/catalog";
import type { Asset, AssetClass, AssetKind, AssetOwner } from "@/lib/types";
import { isComposite } from "@/lib/types";
import { cn, formatBytes, timeAgo, pluralize } from "@/lib/utils";
import { Button, Card, Badge, EmptyState, Modal, TextInput, Segmented } from "@/components/ui";
import { ClassIcon, CompositeBadge } from "@/components/shared";

const MAX_BYTES = 8 * 1024 * 1024; // keep within browser storage for the demo

const kindIcon: Record<AssetKind, typeof ImageIcon> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
};

const CLASS_BY_CATEGORY = Object.fromEntries(ASSET_CLASSES.map((c) => [c.categoryId, c]));

type Scope = "all" | AssetOwner;

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function AssetsView() {
  const router = useRouter();
  const assets = useStore((s) => s.assets);
  const categories = useStore((s) => s.categories);
  const hydrated = useStore((s) => s.hasHydrated);
  const addAsset = useStore((s) => s.addAsset);
  const addCategory = useStore((s) => s.addCategory);
  const renameCategory = useStore((s) => s.renameCategory);
  const removeCategory = useStore((s) => s.removeCategory);
  const setDraftRef = useStore((s) => s.setDraftRef);

  const [scope, setScope] = useState<Scope>("all");
  const [selected, setSelected] = useState<string | "all" | "none">("all");
  const [dragOver, setDragOver] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [editCat, setEditCat] = useState<{ id: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const systemCats = categories.filter((c) => c.system);
  const userCats = categories.filter((c) => !c.system);

  const inScope = useMemo(
    () => assets.filter((a) => scope === "all" || (a.owner ?? "user") === scope),
    [assets, scope],
  );
  const filtered = inScope.filter((a) =>
    selected === "all" ? true : selected === "none" ? a.categoryId === null : a.categoryId === selected,
  );
  const countFor = (id: string | "all" | "none") =>
    id === "all"
      ? inScope.length
      : id === "none"
        ? inScope.filter((a) => a.categoryId === null).length
        : inScope.filter((a) => a.categoryId === id).length;

  async function ingest(files: FileList | File[]) {
    const sysClass = (CLASS_BY_CATEGORY[selected as string] as { key: AssetClass } | undefined)?.key;
    const targetCat = selected !== "all" && selected !== "none" ? selected : null;
    const owner: AssetOwner = scope === "business" ? "business" : "user";
    let skipped = 0;
    for (const file of Array.from(files)) {
      const kind: AssetKind | null = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("audio/")
            ? "audio"
            : null;
      if (!kind || file.size > MAX_BYTES) {
        skipped++;
        continue;
      }
      const url = await readAsDataURL(file);
      addAsset({
        name: file.name.replace(/\.[^.]+$/, ""),
        kind,
        url,
        posterUrl: kind === "image" ? url : undefined,
        categoryId: targetCat,
        class: sysClass,
        owner,
        source: "upload",
      });
    }
    if (skipped > 0)
      setWarn(`${skipped} file${skipped > 1 ? "s were" : " was"} skipped (must be an image, video, or audio under 8 MB).`);
    else setWarn(null);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
  }

  if (!hydrated) return <div className="mx-auto h-8 max-w-6xl w-40 rounded bg-surface-2" />;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assets</h1>
          <p className="mt-1 text-sm text-muted">
            Your library of building blocks — organized into classes, ready to drop into a production.
          </p>
        </div>
        <Button onClick={() => fileRef.current?.click()}>
          <Upload size={16} /> Upload
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={(e) => e.target.files && ingest(e.target.files)}
        />
      </header>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[230px_1fr]">
        {/* Rail */}
        <aside className="space-y-3">
          <Segmented<Scope>
            value={scope}
            onChange={setScope}
            options={[
              { value: "all", label: "All" },
              { value: "user", label: "My" },
              { value: "business", label: "Business" },
            ]}
          />

          <div className="space-y-1">
            <CatRow
              label="All assets"
              icon={<FolderOpen size={16} />}
              count={countFor("all")}
              active={selected === "all"}
              onClick={() => setSelected("all")}
            />

            <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-faint">Classes</div>
            {systemCats.map((c) => {
              const meta = CLASS_BY_CATEGORY[c.id];
              return (
                <CatRow
                  key={c.id}
                  label={c.name}
                  icon={meta ? <ClassIcon icon={meta.icon} size={16} /> : <Folder size={16} />}
                  count={countFor(c.id)}
                  active={selected === c.id}
                  onClick={() => setSelected(c.id)}
                />
              );
            })}

            {userCats.length > 0 && (
              <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-faint">Folders</div>
            )}
            {userCats.map((c) => (
              <CatRow
                key={c.id}
                label={c.name}
                icon={<Folder size={16} />}
                count={countFor(c.id)}
                active={selected === c.id}
                onClick={() => setSelected(c.id)}
                onEdit={() => setEditCat({ id: c.id, name: c.name })}
                onDelete={() => {
                  if (confirm(`Delete folder “${c.name}”? Its assets move to Uncategorized.`)) {
                    removeCategory(c.id);
                    if (selected === c.id) setSelected("all");
                  }
                }}
              />
            ))}

            <CatRow
              label="Uncategorized"
              icon={<Inbox size={16} />}
              count={countFor("none")}
              active={selected === "none"}
              onClick={() => setSelected("none")}
            />
            <button
              onClick={() => setNewCatOpen(true)}
              className="mt-1 flex w-full items-center gap-2 rounded-xl border border-dashed border-line-2 px-3 py-2 text-sm text-muted transition-colors hover:border-accent/40 hover:text-fg"
            >
              <Plus size={15} /> New folder
            </button>
          </div>
        </aside>

        {/* Grid */}
        <section
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "rounded-[var(--radius-xl2)] transition-colors",
            dragOver && "outline-2 outline-dashed outline-accent/60",
          )}
        >
          {warn && (
            <div className="mb-3 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
              {warn}
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Upload size={24} />}
              title={inScope.length === 0 ? "No assets yet" : "Nothing here"}
              description="Drag & drop files here, or use the Upload button. Images, video and audio are supported."
              action={
                <Button variant="soft" onClick={() => fileRef.current?.click()}>
                  <Upload size={16} /> Upload files
                </Button>
              }
            />
          ) : (
            <>
              <div className="mb-3 text-xs text-faint">{pluralize(filtered.length, "asset")}</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {filtered.map((a) => (
                  <AssetCard
                    key={a.id}
                    asset={a}
                    onUse={() => {
                      setDraftRef(a.id);
                      router.push("/app");
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <NameModal
        open={newCatOpen}
        title="New folder"
        placeholder="e.g. Spring campaign"
        onClose={() => setNewCatOpen(false)}
        onSubmit={(name) => {
          const cat = addCategory(name);
          setSelected(cat.id);
          setNewCatOpen(false);
        }}
      />
      <NameModal
        open={!!editCat}
        title="Rename folder"
        initial={editCat?.name}
        onClose={() => setEditCat(null)}
        onSubmit={(name) => {
          if (editCat) renameCategory(editCat.id, name);
          setEditCat(null);
        }}
      />
    </div>
  );
}

function CatRow({
  label,
  icon,
  count,
  active,
  onClick,
  onEdit,
  onDelete,
}: {
  label: string;
  icon: React.ReactNode;
  count: number;
  active: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
        active ? "bg-accent-soft text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span className={active ? "text-accent-2" : ""}>{icon}</span>
        <span className="truncate">{label}</span>
      </button>
      <span className="text-xs tabular-nums text-faint">{count}</span>
      {(onEdit || onDelete) && (
        <span className="hidden items-center gap-0.5 group-hover:flex">
          {onEdit && (
            <button onClick={onEdit} className="rounded p-1 text-faint hover:text-fg" aria-label="Rename">
              <Pencil size={13} />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="rounded p-1 text-faint hover:text-danger" aria-label="Delete">
              <Trash2 size={13} />
            </button>
          )}
        </span>
      )}
    </div>
  );
}

function AssetCard({ asset, onUse }: { asset: Asset; onUse: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const Icon = kindIcon[asset.kind];
  const composite = isComposite(asset);
  return (
    <Card className="group overflow-hidden">
      <div className="relative aspect-square bg-surface-2">
        {asset.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.posterUrl ?? asset.url} alt={asset.name} className="h-full w-full object-cover" />
        ) : asset.kind === "video" ? (
          asset.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.posterUrl} alt={asset.name} className="h-full w-full object-cover" />
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={asset.url} preload="metadata" muted className="h-full w-full object-cover" />
          )
        ) : /\.(svg|png|jpe?g|webp)$/.test(asset.url) ? (
          // Audio with cover art (starter tracks ship generated album art).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-2 to-surface-3">
            <Music size={28} className="text-faint" />
          </div>
        )}
        <span className="absolute left-2 top-2 flex gap-1">
          <Badge tone="neutral" className="bg-black/55 capitalize text-white border-white/20 backdrop-blur-sm">
            <Icon size={11} /> {asset.kind}
          </Badge>
          <CompositeBadge a={asset} />
        </span>
        {asset.owner === "business" && (
          <span className="absolute bottom-2 left-2">
            <Badge tone="neutral" className="bg-black/55 text-white border-white/20 backdrop-blur-sm">
              Business
            </Badge>
          </span>
        )}
        <button
          onClick={() => setMenuOpen(true)}
          className="absolute right-2 top-2 rounded-lg bg-black/55 p-1.5 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/75 group-hover:opacity-100"
          aria-label="Asset actions"
        >
          <MoreHorizontal size={15} />
        </button>
      </div>
      <div className="p-2.5">
        <div className="truncate text-[13px] font-medium text-fg">{asset.name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
          {composite ? (
            <>
              <Layers size={11} /> {asset.parts!.length} parts
            </>
          ) : asset.source === "generation" ? (
            "Generated"
          ) : asset.source === "starter" ? (
            "Starter"
          ) : (
            formatBytes(asset.sizeBytes)
          )}
          <span>·</span>
          {timeAgo(asset.createdAt)}
        </div>
      </div>
      <AssetActions asset={asset} open={menuOpen} onClose={() => setMenuOpen(false)} onUse={onUse} />
    </Card>
  );
}

function AssetActions({
  asset,
  open,
  onClose,
  onUse,
}: {
  asset: Asset;
  open: boolean;
  onClose: () => void;
  onUse: () => void;
}) {
  const categories = useStore((s) => s.categories);
  const moveAsset = useStore((s) => s.moveAsset);
  const removeAsset = useStore((s) => s.removeAsset);
  const renameAsset = useStore((s) => s.renameAsset);
  const [mode, setMode] = useState<"menu" | "move" | "rename">("menu");
  const [name, setName] = useState(asset.name);

  function close() {
    setMode("menu");
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title={mode === "rename" ? "Rename asset" : asset.name} size="sm">
      {mode === "menu" && (
        <div className="space-y-1">
          {isComposite(asset) && (
            <div className="mb-2 rounded-xl border border-line bg-surface-2 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
                <Layers size={12} /> Composite — {asset.parts!.length} parts
              </div>
              <div className="flex flex-wrap gap-1.5">
                {asset.parts!.map((p, i) => (
                  <Badge key={i} tone="neutral" className="capitalize">
                    {p.role}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <ActionItem icon={<Sparkles size={16} />} label="Use in Make" onClick={() => { onUse(); close(); }} />
          <ActionItem icon={<FolderInput size={16} />} label="Move to folder" onClick={() => setMode("move")} />
          <ActionItem icon={<Pencil size={16} />} label="Rename" onClick={() => setMode("rename")} />
          <ActionItem
            icon={<Trash2 size={16} />}
            label="Delete"
            danger
            onClick={() => {
              removeAsset(asset.id);
              close();
            }}
          />
        </div>
      )}

      {mode === "move" && (
        <div className="space-y-1">
          <MoveTarget
            label="Uncategorized"
            active={asset.categoryId === null}
            onClick={() => { moveAsset(asset.id, null); close(); }}
          />
          {categories.map((c) => (
            <MoveTarget
              key={c.id}
              label={c.name}
              active={asset.categoryId === c.id}
              onClick={() => { moveAsset(asset.id, c.id); close(); }}
            />
          ))}
        </div>
      )}

      {mode === "rename" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) renameAsset(asset.id, name.trim());
            close();
          }}
        >
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Cancel</Button>
            <Button type="submit" size="sm">Save</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ActionItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
        danger ? "text-danger hover:bg-danger/10" : "text-fg hover:bg-surface-2",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function MoveTarget({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm text-fg transition-colors hover:bg-surface-2"
    >
      <span className="flex items-center gap-2.5">
        <Folder size={16} className="text-faint" /> {label}
      </span>
      {active && <Check size={16} className="text-teal" />}
    </button>
  );
}

function NameModal({
  open,
  title,
  placeholder,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  placeholder?: string;
  initial?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial ?? "");
  useEffect(() => {
    if (open) setName(initial ?? "");
  }, [open, initial]);
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSubmit(name.trim());
          setName("");
        }}
      >
        <TextInput
          autoFocus
          value={name}
          placeholder={placeholder}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm">Save</Button>
        </div>
      </form>
    </Modal>
  );
}
