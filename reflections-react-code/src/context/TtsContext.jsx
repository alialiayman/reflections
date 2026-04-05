import OpenAI from "openai";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_TTS_VOICE,
  OPENAI_TTS_VOICES,
  TTS_VOICE_STORAGE_KEY,
} from "../constants/tts";
import { markdownToPlainText } from "../utils/markdown-plain-text";

const TTS_INPUT_MAX = 4096;

export function chunkPlainTextForTts(text) {
  const t = (text || "").trim();
  if (!t) {
    return [];
  }
  const parts = [];
  for (let i = 0; i < t.length; i += TTS_INPUT_MAX) {
    parts.push(t.slice(i, i + TTS_INPUT_MAX));
  }
  return parts;
}

const TtsContext = createContext(null);

export function TtsProvider({ children, getApiKey, enabled, sectionMarkdownsRef }) {
  const [voice, setVoiceState] = useState(() => {
    try {
      const v = localStorage.getItem(TTS_VOICE_STORAGE_KEY);
      return OPENAI_TTS_VOICES.some((x) => x.id === v) ? v : DEFAULT_TTS_VOICE;
    } catch {
      return DEFAULT_TTS_VOICE;
    }
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSectionIndex, setActiveSectionIndex] = useState(null);
  const [isGlobalArticle, setIsGlobalArticle] = useState(false);

  const audioRef = useRef(null);
  const urlRef = useRef(null);
  const stopFlagRef = useRef(false);

  const releaseAudio = useCallback(() => {
    try {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
        audioRef.current = null;
      }
    } catch {
      /* ignore */
    }
  }, []);

  const stop = useCallback(() => {
    stopFlagRef.current = true;
    releaseAudio();
    setIsSpeaking(false);
    setActiveSectionIndex(null);
    setIsGlobalArticle(false);
  }, [releaseAudio]);

  const setVoice = useCallback((id) => {
    if (!OPENAI_TTS_VOICES.some((v) => v.id === id)) {
      return;
    }
    setVoiceState(id);
    try {
      localStorage.setItem(TTS_VOICE_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const playInputChunks = useCallback(
    async (chunks, { sectionIndex, isGlobal }) => {
      if (!enabled || !chunks.length) {
        return;
      }
      const key = getApiKey();
      if (!key) {
        return;
      }

      const client = new OpenAI({
        apiKey: key,
        dangerouslyAllowBrowser: true,
      });

      for (const input of chunks) {
        if (stopFlagRef.current) {
          break;
        }
        const response = await client.audio.speech.create({
          model: "tts-1",
          voice,
          input,
        });
        const buf = await response.arrayBuffer();
        releaseAudio();
        const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
        urlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        await new Promise((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("Audio playback failed"));
          audio.play().catch(reject);
        });
      }
    },
    [enabled, voice, getApiKey, releaseAudio]
  );

  const speakSection = useCallback(
    async (sectionIndex, markdown) => {
      if (!enabled) {
        return;
      }
      stop();
      await Promise.resolve();
      stopFlagRef.current = false;
      setIsSpeaking(true);
      setIsGlobalArticle(false);
      setActiveSectionIndex(sectionIndex);

      try {
        const plain = markdownToPlainText(markdown);
        const chunks = chunkPlainTextForTts(plain);
        await playInputChunks(chunks, { sectionIndex, isGlobal: false });
      } catch (e) {
        console.error("OpenAI TTS (section)", e);
      } finally {
        releaseAudio();
        setIsSpeaking(false);
        setActiveSectionIndex(null);
        setIsGlobalArticle(false);
      }
    },
    [enabled, stop, playInputChunks, releaseAudio]
  );

  const speakFullArticle = useCallback(async () => {
    if (!enabled) {
      return;
    }
    const sections = Array.isArray(sectionMarkdownsRef?.current)
      ? sectionMarkdownsRef.current
      : [];
    if (!sections.length) {
      return;
    }

    stop();
    await Promise.resolve();
    stopFlagRef.current = false;
    setIsSpeaking(true);
    setIsGlobalArticle(true);

    try {
      for (let i = 0; i < sections.length; i++) {
        if (stopFlagRef.current) {
          break;
        }
        setActiveSectionIndex(i);
        const plain = markdownToPlainText(sections[i]);
        const chunks = chunkPlainTextForTts(plain);
        await playInputChunks(chunks, { sectionIndex: i, isGlobal: true });
      }
    } catch (e) {
      console.error("OpenAI TTS (article)", e);
    } finally {
      releaseAudio();
      setIsSpeaking(false);
      setActiveSectionIndex(null);
      setIsGlobalArticle(false);
    }
  }, [enabled, stop, sectionMarkdownsRef, playInputChunks, releaseAudio]);

  const toggleGlobalSpeak = useCallback(() => {
    if (isSpeaking && isGlobalArticle) {
      stop();
      return;
    }
    stop();
    void speakFullArticle();
  }, [isSpeaking, isGlobalArticle, stop, speakFullArticle]);

  const value = useMemo(
    () => ({
      voice,
      setVoice,
      speakSection,
      speakFullArticle,
      stop,
      toggleGlobalSpeak,
      isSpeaking,
      activeSectionIndex,
      isGlobalArticle,
      ttsEnabled: enabled,
    }),
    [
      voice,
      setVoice,
      speakSection,
      speakFullArticle,
      stop,
      toggleGlobalSpeak,
      isSpeaking,
      activeSectionIndex,
      isGlobalArticle,
      enabled,
    ]
  );

  return <TtsContext.Provider value={value}>{children}</TtsContext.Provider>;
}

export function useTts() {
  const ctx = useContext(TtsContext);
  if (!ctx) {
    throw new Error("useTts must be used within TtsProvider");
  }
  return ctx;
}
