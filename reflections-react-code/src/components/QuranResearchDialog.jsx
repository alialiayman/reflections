import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchVerseRange } from "../utils/quran-api";
import { githubBase64ToUtf8, utf8ToBase64 } from "../utils/github-text-encoding";
import { suggestQuranTags } from "../utils/openai-quran-tags";
import {
  QURAN_RESEARCH_FILENAME,
  parseQuranResearchMarkdown,
  serializeQuranResearchMarkdown,
} from "../utils/quran-research-format";
import { getArabicSurahName } from "../constants/surah-arabic-names";

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_REPO_OWNER = "alialiayman";
const GITHUB_REPO_NAME = "reflections";
const GITHUB_BRANCH = "main";

const encodeRepoPath = (repoPath) =>
  repoPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const newItemId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `q-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export default function QuranResearchDialog({
  open,
  onClose,
  githubToken,
  canEditReflections,
  folderSegments = [],
  onNotify,
  getOpenAiKey,
}) {
  const [items, setItems] = useState([]);
  const [fileSha, setFileSha] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [suggestingId, setSuggestingId] = useState(null);

  const [surahInput, setSurahInput] = useState("1");
  const [fromInput, setFromInput] = useState("1");
  const [toInput, setToInput] = useState("1");

  const [editingId, setEditingId] = useState(null);
  const [tagFilter, setTagFilter] = useState(null);
  const [newTagDraft, setNewTagDraft] = useState({});

  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;

  const notify = useCallback((message, severity = "info") => {
    onNotifyRef.current?.({ message, severity });
  }, []);

  const contentsUrl = useMemo(() => {
    const repoPath = [...folderSegments, QURAN_RESEARCH_FILENAME].join("/");
    return `${GITHUB_API_BASE}/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${encodeRepoPath(
      repoPath
    )}`;
  }, [folderSegments]);

  useEffect(() => {
    if (!open || !githubToken) {
      return undefined;
    }
    let cancelled = false;
    setEditingId(null);
    setTagFilter(null);
    setLoadingFile(true);

    (async () => {
      try {
        const r = await axios.get(`${contentsUrl}?ref=${GITHUB_BRANCH}`, {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
          },
        });
        if (cancelled) {
          return;
        }
        const decoded = githubBase64ToUtf8(r.data.content);
        const parsed = parseQuranResearchMarkdown(decoded);
        if (cancelled) {
          return;
        }
        setItems(parsed?.items?.length ? parsed.items : []);
        setFileSha(r.data.sha || null);
      } catch (err) {
        if (cancelled) {
          return;
        }
        if (err?.response?.status === 404) {
          setItems([]);
          setFileSha(null);
        } else {
          const msg = err?.response?.data?.message || err?.message || "Load failed";
          onNotifyRef.current?.({
            message: `Could not load ${QURAN_RESEARCH_FILENAME}: ${msg}`,
            severity: "warning",
          });
          setItems([]);
          setFileSha(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingFile(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, githubToken, contentsUrl]);

  const allTags = useMemo(() => {
    const s = new Set();
    items.forEach((it) => it.tags.forEach((t) => s.add(t)));
    return [...s].sort((a, b) => a.localeCompare(b, "ar"));
  }, [items]);

  const displayedItems = useMemo(() => {
    if (!tagFilter) {
      return items.map((it) => ({ item: it }));
    }
    return items
      .filter((it) => it.tags.includes(tagFilter))
      .map((it) => ({ item: it }));
  }, [items, tagFilter]);

  const handleAddRange = async () => {
    const surah = Number.parseInt(surahInput, 10);
    const from = Number.parseInt(fromInput, 10);
    const to = Number.parseInt(toInput, 10);
    if (![surah, from, to].every((n) => Number.isInteger(n))) {
      notify("Enter valid numbers for surah and verses.", "warning");
      return;
    }
    setFetching(true);
    try {
      const result = await fetchVerseRange(surah, from, to);
      setItems((prev) => [
        ...prev,
        {
          id: newItemId(),
          surah: result.surah,
          from: result.start,
          to: result.end,
          text: result.text,
          tags: [],
          arabicName: result.arabicName || getArabicSurahName(result.surah),
        },
      ]);
      notify(
        `Loaded ${result.arabicName || getArabicSurahName(result.surah)} (${result.surah}:${result.start}–${result.end}).`,
        "success"
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to fetch verses.", "error");
    } finally {
      setFetching(false);
    }
  };

  const reorderById = (fromId, toId) => {
    if (tagFilter || fromId === toId) {
      return;
    }
    setItems((prev) => {
      const fromIdx = prev.findIndex((x) => x.id === fromId);
      const toIdx = prev.findIndex((x) => x.id === toId);
      if (fromIdx < 0 || toIdx < 0) {
        return prev;
      }
      const next = [...prev];
      const [removed] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, removed);
      return next;
    });
  };

  const addTag = (itemId, rawTag) => {
    const tag = rawTag.trim();
    if (!tag) {
      return;
    }
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId && !it.tags.includes(tag)
          ? { ...it, tags: [...it.tags, tag] }
          : it
      )
    );
    setNewTagDraft((d) => ({ ...d, [itemId]: "" }));
  };

  const removeTag = (itemId, tag) => {
    if (editingId !== itemId) {
      return;
    }
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, tags: it.tags.filter((t) => t !== tag) } : it
      )
    );
  };

  const handleSaveGithub = async () => {
    if (!canEditReflections || !githubToken) {
      notify("Saving requires editor access on this repository.", "warning");
      return;
    }
    const md = serializeQuranResearchMarkdown(
      items.map((it) => ({
        ...it,
        arabicName: (it.arabicName && String(it.arabicName).trim()) || getArabicSurahName(it.surah),
      }))
    );
    setSaving(true);
    try {
      const body = {
        message: `Update ${QURAN_RESEARCH_FILENAME} (Quran research tool)`,
        content: utf8ToBase64(md),
        branch: GITHUB_BRANCH,
      };
      if (fileSha) {
        body.sha = fileSha;
      }
      const r = await axios.put(contentsUrl, body, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
        },
      });
      setFileSha(r.data?.content?.sha || fileSha);
      notify(`Saved ${QURAN_RESEARCH_FILENAME} to this folder on GitHub.`, "success");
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Save failed";
      notify(`Save failed: ${msg}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSuggestTags = async (item) => {
    if (!getOpenAiKey) {
      notify("OpenAI is not configured for this app.", "warning");
      return;
    }
    const refForAi = `${item.arabicName || getArabicSurahName(item.surah) || "سورة"} ${item.surah}:${item.from}${
      item.from !== item.to ? `–${item.to}` : ""
    }`;
    setSuggestingId(item.id);
    try {
      const suggested = await suggestQuranTags(item.text, refForAi.trim(), getOpenAiKey);
      if (!suggested.length) {
        notify("No tags were suggested.", "info");
        return;
      }
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== item.id) {
            return it;
          }
          const merged = [...it.tags];
          suggested.forEach((t) => {
            if (!merged.includes(t)) {
              merged.push(t);
            }
          });
          return { ...it, tags: merged };
        })
      );
      notify("Tags merged from AI suggestion.", "success");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Tag suggestion failed.", "error");
    } finally {
      setSuggestingId(null);
    }
  };

  const verseAyahRange = (it) =>
    `${it.surah}:${it.from}${it.from !== it.to ? `–${it.to}` : ""}`;

  const arabicSurahTitle = (it) =>
    (it.arabicName && String(it.arabicName).trim()) || getArabicSurahName(it.surah) || `سورة ${it.surah}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      scroll="paper"
      PaperProps={{
        sx: {
          background: "linear-gradient(165deg, #16162a 0%, #0c0c14 45%, #12121c 100%)",
          color: textPrimary,
          minHeight: "70vh",
          maxHeight: "92vh",
          border: `1px solid ${borderStrong}`,
          borderRadius: 3,
          boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(90deg, rgba(94,234,212,0.14) 0%, transparent 55%)",
          borderBottom: `1px solid ${borderStrong}`,
          pr: 1,
          py: 2,
          color: textPrimary,
        }}
      >
        <Box>
          <Typography variant="overline" sx={{ color: textMuted, letterSpacing: "0.12em", display: "block" }}>
            Reflections
          </Typography>
          <Typography variant="h6" component="span" sx={{ color: textPrimary, fontWeight: 700 }}>
            Quran research
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="close" sx={{ color: textPrimary }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: borderMuted, color: textPrimary, pt: 3 }}>
        <Stack spacing={3}>
        <Typography variant="body2" sx={{ color: textSecondary, lineHeight: 1.7 }}>
          Verses load from{" "}
          <Box component="span" sx={{ color: accentBright, fontWeight: 600 }}>
            api.alquran.cloud
          </Box>{" "}
          (Uthmani text, no API key). Saved as{" "}
          <Box component="span" sx={{ fontWeight: 700, color: textPrimary }}>{QURAN_RESEARCH_FILENAME}</Box>{" "}
          in this folder. Select a block to remove tags; click a tag to filter; drag to reorder when
          not filtering.
        </Typography>

        {!canEditReflections && githubToken && (
          <Alert
            severity="info"
            sx={{ ...alertInfoSx }}
          >
            You are signed in; verse lookup works. Saving to GitHub needs editor access (same as
            README edits).
          </Alert>
        )}

        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: "rgba(255,255,255,0.05)",
            border: `1px solid ${borderStrong}`,
            backdropFilter: "blur(8px)",
          }}
        >
          <Typography variant="caption" sx={{ color: textMuted, textTransform: "uppercase", letterSpacing: "0.08em", mb: 1.5, display: "block" }}>
            Fetch verses
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap" useFlexGap alignItems={{ sm: "center" }}>
          <TextField
            size="small"
            label="Surah"
            type="number"
            value={surahInput}
            onChange={(e) => setSurahInput(e.target.value)}
            inputProps={{ min: 1, max: 114 }}
            sx={{ ...fieldSx, minWidth: 100 }}
          />
          <TextField
            size="small"
            label="From ayah"
            type="number"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            inputProps={{ min: 1 }}
            sx={{ ...fieldSx, minWidth: 110 }}
          />
          <TextField
            size="small"
            label="To ayah"
            type="number"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            inputProps={{ min: 1 }}
            sx={{ ...fieldSx, minWidth: 110 }}
          />
          <Button
            variant="contained"
            disabled={fetching}
            onClick={handleAddRange}
            sx={{
              bgcolor: "#2dd4bf",
              color: "#0f172a",
              fontWeight: 700,
              px: 2.5,
              borderRadius: 2,
              boxShadow: "0 4px 20px rgba(45,212,191,0.35)",
              "&:hover": { bgcolor: "#5eead4", boxShadow: "0 6px 24px rgba(45,212,191,0.45)" },
              "&.Mui-disabled": { bgcolor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.4)" },
            }}
          >
            {fetching ? <CircularProgress size={22} sx={{ color: "#0f172a" }} /> : "Retrieve verses"}
          </Button>
          {loadingFile && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: { sm: 1 } }}>
              <CircularProgress size={20} sx={{ color: accentBright }} />
              <Typography variant="caption" sx={{ color: textSecondary }}>
                Loading saved file…
              </Typography>
            </Box>
          )}
          </Stack>
        </Paper>

        {allTags.length > 0 && (
          <Box>
            <Typography variant="caption" sx={{ display: "block", mb: 0.75, color: textMuted }}>
              Tags (click to group verses; “Show all” clears)
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
              <Chip
                size="small"
                label="Show all verses"
                onClick={() => setTagFilter(null)}
                variant="outlined"
                sx={{
                  ...chipBaseSx,
                  ...(tagFilter == null ? chipActiveFilterSx : {}),
                }}
              />
              {allTags.map((t) => (
                <Chip
                  key={t}
                  size="small"
                  label={t}
                  onClick={() => setTagFilter((cur) => (cur === t ? null : t))}
                  variant="outlined"
                  sx={{
                    ...chipBaseSx,
                    ...(tagFilter === t ? chipActiveFilterSx : {}),
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {tagFilter && (
          <Alert severity="warning" sx={{ ...alertWarningSx }}>
            Filtering by tag “{tagFilter}”. Drag-and-drop reorder is disabled. Choose “Show all
            verses” to edit order again.
          </Alert>
        )}

        <Stack spacing={2}>
          {displayedItems.length === 0 && !loadingFile && (
            <Paper
              elevation={0}
              sx={{
                p: 3,
                textAlign: "center",
                bgcolor: "rgba(255,255,255,0.04)",
                border: `1px dashed ${borderStrong}`,
                borderRadius: 2,
              }}
            >
              <Typography variant="body2" sx={{ color: textMuted }}>
                No verses yet. Enter surah and ayah range, then retrieve.
              </Typography>
            </Paper>
          )}
          {displayedItems.map(({ item }) => (
            <Paper
              key={item.id}
              elevation={0}
              onClick={() => setEditingId((id) => (id === item.id ? null : item.id))}
              draggable={!tagFilter}
              onDragStart={(e) => {
                if (tagFilter) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.setData("text/plain", item.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!tagFilter) {
                  e.preventDefault();
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const fromId = e.dataTransfer.getData("text/plain");
                reorderById(fromId, item.id);
              }}
              sx={{
                p: 2.5,
                bgcolor:
                  editingId === item.id ? "rgba(94, 234, 212, 0.08)" : "rgba(255,255,255,0.04)",
                border: "1px solid",
                borderColor:
                  editingId === item.id ? accentBright : borderStrong,
                borderLeft: `4px solid ${editingId === item.id ? accentBright : "rgba(94,234,212,0.45)"}`,
                borderRadius: 2,
                cursor: "pointer",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                boxShadow: editingId === item.id ? "0 0 0 1px rgba(94,234,212,0.2)" : "none",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 1,
                  mb: 1.5,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
                  {!tagFilter && (
                    <DragIndicatorIcon sx={{ color: textMuted, cursor: "grab" }} />
                  )}
                  <Typography
                    component="span"
                    dir="rtl"
                    sx={{
                      fontWeight: 800,
                      color: accentBright,
                      fontSize: "1.2rem",
                      letterSpacing: "0.02em",
                      lineHeight: 1.3,
                    }}
                  >
                    {arabicSurahTitle(item)}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{
                      color: textSecondary,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: "0.8rem",
                      bgcolor: "rgba(255,255,255,0.1)",
                      px: 1,
                      py: 0.35,
                      borderRadius: 1,
                      border: `1px solid ${borderMuted}`,
                    }}
                  >
                    {verseAyahRange(item)}
                  </Typography>
                  {editingId === item.id && (
                    <Chip
                      size="small"
                      label="Editing tags"
                      variant="outlined"
                      sx={{ ...chipBaseSx, ...chipEditingSx }}
                    />
                  )}
                </Box>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  <Tooltip title="Copy verse text">
                    <IconButton
                      size="small"
                      aria-label="copy verse"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard?.writeText(item.text).then(
                          () => notify("Copied verse text.", "success"),
                          () => notify("Could not copy.", "error")
                        );
                      }}
                      sx={{ color: textPrimary, "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {getOpenAiKey && (
                    <Tooltip title="Suggest tags with OpenAI">
                      <span>
                        <IconButton
                          size="small"
                          aria-label="suggest tags"
                          disabled={suggestingId === item.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSuggestTags(item);
                          }}
                          sx={{
                            color: iconGold,
                            "&:hover": { bgcolor: "rgba(255, 213, 79, 0.12)" },
                            "&.Mui-disabled": { color: "rgba(255,255,255,0.35)" },
                          }}
                        >
                          {suggestingId === item.id ? (
                            <CircularProgress size={18} sx={{ color: iconGold }} />
                          ) : (
                            <AutoAwesomeIcon fontSize="small" />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Box>
              </Box>

              <Typography
                component="div"
                dir="rtl"
                sx={{
                  fontSize: "1.18rem",
                  lineHeight: 2,
                  mb: 1.5,
                  color: textPrimary,
                  whiteSpace: "pre-wrap",
                  bgcolor: "rgba(0,0,0,0.2)",
                  borderRadius: 1.5,
                  px: 2,
                  py: 1.5,
                }}
              >
                {item.text}
              </Typography>

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center", mb: 1 }}>
                {item.tags.map((t) => (
                  <Chip
                    key={t}
                    size="small"
                    label={t}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTagFilter((cur) => (cur === t ? null : t));
                    }}
                    onDelete={
                      editingId === item.id ? () => removeTag(item.id, t) : undefined
                    }
                    variant="outlined"
                    sx={{
                      ...chipBaseSx,
                      ...(editingId === item.id ? chipDeletableSx : {}),
                    }}
                  />
                ))}
              </Box>

              <Box
                sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}
                onClick={(e) => e.stopPropagation()}
              >
                <TextField
                  size="small"
                  placeholder="New tag"
                  value={newTagDraft[item.id] ?? ""}
                  onChange={(e) =>
                    setNewTagDraft((d) => ({ ...d, [item.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addTag(item.id, newTagDraft[item.id] ?? "");
                    }
                  }}
                  sx={{ ...fieldSx, minWidth: 160 }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddIcon sx={{ color: "inherit" }} />}
                  onClick={() => addTag(item.id, newTagDraft[item.id] ?? "")}
                  sx={outlinedButtonLightSx}
                >
                  Add tag
                </Button>
              </Box>
            </Paper>
          ))}
        </Stack>
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          py: 2,
          borderTop: `1px solid ${borderStrong}`,
          bgcolor: "rgba(0,0,0,0.2)",
        }}
      >
        <Button onClick={onClose} sx={{ color: textPrimary, "&:hover": { bgcolor: "rgba(255,255,255,0.08)" } }}>
          Close
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={18} sx={{ color: "#0d1f1a" }} /> : <SaveIcon />}
          disabled={saving || !canEditReflections || !githubToken}
          onClick={handleSaveGithub}
          sx={{
            bgcolor: "#5eead4",
            color: "#0f172a",
            fontWeight: 700,
            "&:hover": { bgcolor: "#99f6e4" },
            "&.Mui-disabled": {
              bgcolor: "rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.45)",
            },
          }}
        >
          Save to GitHub
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Dark-dialog palette: WCAG-friendly on #12121c */
const textPrimary = "#f1f5f9";
const textSecondary = "#e2e8f0";
const textMuted = "#cbd5e1";
const accentBright = "#5eead4";
const borderStrong = "rgba(255,255,255,0.28)";
const borderMuted = "rgba(255,255,255,0.12)";
const iconGold = "#fde68a";
const placeholderColor = "rgba(241,245,249,0.55)";

const chipBaseSx = {
  borderColor: "rgba(255,255,255,0.55)",
  bgcolor: "rgba(255,255,255,0.1)",
  color: textPrimary,
  "& .MuiChip-label": {
    color: textPrimary,
    fontWeight: 500,
  },
  "&:hover": {
    bgcolor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.7)",
  },
};

const chipActiveFilterSx = {
  borderColor: accentBright,
  bgcolor: "rgba(94, 234, 212, 0.2)",
  color: textPrimary,
  "& .MuiChip-label": { color: textPrimary, fontWeight: 700 },
  "&:hover": {
    bgcolor: "rgba(94, 234, 212, 0.28)",
    borderColor: accentBright,
  },
};

const chipEditingSx = {
  borderColor: accentBright,
  bgcolor: "rgba(94, 234, 212, 0.12)",
  "& .MuiChip-label": { fontWeight: 600 },
};

const chipDeletableSx = {
  "& .MuiChip-deleteIcon": {
    color: "#fecaca",
    fontSize: "1.125rem",
    "&:hover": { color: "#fee2e2" },
  },
};

const alertInfoSx = {
  bgcolor: "rgba(56, 189, 248, 0.12)",
  color: textPrimary,
  border: "1px solid rgba(56, 189, 248, 0.45)",
  "& .MuiAlert-icon": { color: "#7dd3fc" },
  "& .MuiAlert-message": { color: textPrimary },
};

const alertWarningSx = {
  bgcolor: "rgba(251, 191, 36, 0.12)",
  color: textPrimary,
  border: "1px solid rgba(251, 191, 36, 0.45)",
  "& .MuiAlert-icon": { color: "#fcd34d" },
  "& .MuiAlert-message": { color: textPrimary },
};

const outlinedButtonLightSx = {
  borderColor: "rgba(255,255,255,0.55)",
  color: textPrimary,
  fontWeight: 600,
  "&:hover": {
    borderColor: accentBright,
    bgcolor: "rgba(94, 234, 212, 0.08)",
    color: accentBright,
  },
};

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    color: textPrimary,
    "& fieldset": { borderColor: "rgba(255,255,255,0.45)" },
    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.65)" },
    "&.Mui-focused fieldset": { borderColor: accentBright, borderWidth: "2px" },
  },
  "& .MuiOutlinedInput-input::placeholder": {
    color: placeholderColor,
    opacity: 1,
  },
  "& .MuiInputLabel-root": {
    color: textMuted,
    "&.Mui-focused": { color: accentBright },
  },
  "& .MuiFormHelperText-root": { color: textMuted },
};
