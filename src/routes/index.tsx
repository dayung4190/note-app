import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inkwell — Markdown Notes" },
      { name: "description", content: "Write markdown notes with live preview, tags, search and keyboard shortcuts." },
      { property: "og:title", content: "Inkwell — Markdown Notes" },
      { property: "og:description", content: "Write markdown notes with live preview, tags, search and keyboard shortcuts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotesApp,
});

type Note = { id: string; title: string; body: string; tags: string[]; updatedAt: number };
type Mode = "split" | "write" | "read";

const STORAGE_KEY = "inkwell-notes-v1";

const WELCOME: Note = {
  id: "welcome",
  title: "Welcome to Inkwell",
  tags: ["guide"],
  updatedAt: Date.now(),
  body: `# Welcome to Inkwell

A quiet place for **markdown** notes. Everything saves to your browser automatically.

## Shortcuts
- \`Ctrl/⌘ + N\` — new note
- \`Ctrl/⌘ + K\` — search
- \`Ctrl/⌘ + E\` — cycle write / split / read

## Things you can write
- [x] Task lists
- [ ] Tables and code blocks

| Feature | Status |
| --- | --- |
| Live preview | ✓ |
| Tags | ✓ |

\`\`\`js
console.log("hello, notes");
\`\`\`

> Good notes are letters to your future self.
`,
};

const uid = () => Math.random().toString(36).slice(2, 10);
const titleFrom = (body: string) =>
  body.split("\n").find((l) => l.trim())?.replace(/^#+\s*/, "").slice(0, 60) || "Untitled";

function timeAgo(t: number) {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t).toLocaleDateString();
}

function NotesApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("split");
  const [tagInput, setTagInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "editor">("list");
  const isMobile = useIsMobile();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Note[] | null;
      const list = saved && saved.length ? saved : [WELCOME];
      setNotes(list);
      setActiveId(list[0]?.id ?? "");
    } catch {
      setNotes([WELCOME]);
      setActiveId(WELCOME.id);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes, loaded]);

  const active = notes.find((n) => n.id === activeId);
  const allTags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort(), [notes]);

  const visible = useMemo(() => {
    const q = query.toLowerCase();
    return [...notes]
      .filter((n) => (!tagFilter || n.tags.includes(tagFilter)) && (!q || (n.title + n.body).toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, query, tagFilter]);

  const createNote = () => {
    const n: Note = { id: uid(), title: "Untitled", body: "# Untitled\n\n", tags: tagFilter ? [tagFilter] : [], updatedAt: Date.now() };
    setNotes((p) => [n, ...p]);
    setActiveId(n.id);
    setMode((m) => (m === "read" ? "split" : m));
  };

  const update = (patch: Partial<Note>) =>
    setNotes((p) => p.map((n) => (n.id === activeId ? { ...n, ...patch, updatedAt: Date.now() } : n)));

  const remove = () => {
    if (!active || !confirm(`Delete "${active.title}"?`)) return;
    const rest = notes.filter((n) => n.id !== active.id);
    setNotes(rest);
    setActiveId(rest[0]?.id ?? "");
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && active && !active.tags.includes(t)) update({ tags: [...active.tags, t] });
    setTagInput("");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "n") { e.preventDefault(); createNote(); }
      if (k === "k") { e.preventDefault(); searchRef.current?.focus(); }
      if (k === "e") { e.preventDefault(); setMode((m) => (m === "write" ? "split" : m === "split" ? "read" : "write")); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const words = active ? active.body.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-72 shrink-0 flex-col border-r bg-sidebar">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h1 className="font-serif text-2xl font-semibold italic tracking-tight">Inkwell</h1>
          <button onClick={createNote} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90" title="New note (Ctrl/⌘+N)">
            + New
          </button>
        </div>
        <div className="px-5 pb-3">
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…  ⌘K"
            className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-5 pb-3">
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
                className={`rounded-full border px-2.5 py-0.5 font-mono text-xs transition ${tagFilter === t ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
        <ul className="flex-1 overflow-y-auto border-t">
          {visible.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => setActiveId(n.id)}
                className={`block w-full border-b border-l-4 px-5 py-3 text-left transition ${n.id === activeId ? "border-l-primary bg-card" : "border-l-transparent hover:bg-accent/50"}`}
              >
                <div className="truncate font-serif text-base font-semibold">{n.title}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {n.body.replace(/[#*`>\-[\]|]/g, "").split("\n").filter(Boolean).slice(1).join(" ") || "Empty note"}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{timeAgo(n.updatedAt)}</div>
              </button>
            </li>
          ))}
          {visible.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No notes found.</li>}
        </ul>
        <div className="border-t px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {notes.length} notes · saved locally
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {active ? (
          <>
            <header className="flex flex-wrap items-center gap-3 border-b px-6 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {active.tags.map((t) => (
                  <span key={t} className="group flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 font-mono text-xs">
                    #{t}
                    <button onClick={() => update({ tags: active.tags.filter((x) => x !== t) })} className="text-muted-foreground hover:text-destructive" aria-label={`Remove tag ${t}`}>×</button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTag()}
                  onBlur={addTag}
                  placeholder="+ tag"
                  className="w-20 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="ml-auto flex items-center gap-3">
                <div className="flex rounded-md border bg-card p-0.5 text-xs" title="Ctrl/⌘+E">
                  {(["write", "split", "read"] as Mode[]).map((m) => (
                    <button key={m} onClick={() => setMode(m)} className={`rounded px-3 py-1 capitalize transition ${mode === m ? "bg-foreground text-background" : "hover:bg-muted"}`}>
                      {m}
                    </button>
                  ))}
                </div>
                <button onClick={remove} className="text-xs text-muted-foreground hover:text-destructive">Delete</button>
              </div>
            </header>
            <div className="flex min-h-0 flex-1">
              {mode !== "read" && (
                <textarea
                  value={active.body}
                  onChange={(e) => update({ body: e.target.value, title: titleFrom(e.target.value) })}
                  spellCheck={false}
                  className={`min-h-0 resize-none bg-card p-8 font-mono text-sm leading-7 outline-none ${mode === "split" ? "w-1/2 border-r" : "w-full"}`}
                  placeholder="Start writing markdown…"
                />
              )}
              {mode !== "write" && (
                <article className={`min-h-0 overflow-y-auto px-10 py-8 ${mode === "split" ? "w-1/2" : "mx-auto w-full max-w-3xl"}`}>
                  <div className="prose-note">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{active.body}</ReactMarkdown>
                  </div>
                </article>
              )}
            </div>
            <footer className="flex gap-4 border-t px-6 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>{words} words</span>
              <span>{active.body.length} chars</span>
              <span>~{Math.max(1, Math.round(words / 200))} min read</span>
              <span className="ml-auto">edited {timeAgo(active.updatedAt)}</span>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
            <p className="font-serif text-2xl italic">An empty page awaits.</p>
            <button onClick={createNote} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Create a note</button>
          </div>
        )}
      </main>
    </div>
  );
}
