import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogContent,
  IconButton,
  InputAdornment,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SendIcon from "@mui/icons-material/Send";
import { useEffect, useState } from "react";
import "./App.css";
import Header from "./components/header";
import Main from "./components/main";
import { getVisionKey } from "./constants";

const DEFAULT_COPY_LIMIT = 3500;

function getCopyLimitFromQuery() {
  const query = window.location.search;
  const match = query.match(/\d+/); // Find the first number in the query string
  return match ? parseInt(match[0], 10) : DEFAULT_COPY_LIMIT;
}

const COPY_LIMIT = getCopyLimitFromQuery();
const REFERENCE_LINK = "\nhttps://a-reflections.web.app";

function App() {
  const [loadingChunks, setLoadingChunks] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copyIndex, setCopyIndex] = useState(0);
  const [textChunks, setTextChunks] = useState([]);
  const [images, setImages] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageName, setSelectedImageName] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [imageDescription, setImageDescription] = useState("");
  const [describingImage, setDescribingImage] = useState(false);
  const [borderColorIndex, setBorderColorIndex] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [userQuestion, setUserQuestion] = useState("");
  const [askingQuestion, setAskingQuestion] = useState(false);
  const [imageBase64Data, setImageBase64Data] = useState(null);


  const borderColors = [
    "#6C63FF",
    "#00BFA6",
    "#FF6F61",
    "#FFD600",
    "#448AFF",
    "#E040FB",
    "#FF9100",
  ];
  const [copyToast, setCopyToast] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const path = window.location.pathname;

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const response = await fetch(
          `https://api.github.com/repos/alialiayman/reflections/contents/${
            path === "/" ? "" : path
          }?ref=main`
        );
        const data = await response.json();

        if (Array.isArray(data)) {
          const imageFiles = data
            .filter((file) => {
              const lowerName = file.name.toLowerCase();
              return (
                lowerName.endsWith(".jpg") ||
                lowerName.endsWith(".jpeg") ||
                lowerName.endsWith(".png")
              );
            })
            .map((file) => ({
              name: file.name,
              url: file.download_url,
            }));

          setImages(imageFiles);
        }
      } catch (error) {
        console.error("Failed to fetch images", error);
      }
    };

    fetchImages();
  }, [path]);

  useEffect(() => {
    const readmeDiv = document.getElementById("readme");
    if (!readmeDiv) return;
    // MutationObserver to wait until content is loaded inside #readme
    const observer = new MutationObserver(() => {
      const fullText = readmeDiv.innerText.trim();
      if (fullText.length > COPY_LIMIT / 2) {
        const chunks = splitTextIntoChunks(fullText);
        setTextChunks(chunks);
        setLoadingChunks(false); // ✅ Set as ready
        observer.disconnect(); // Stop observing once text is ready
      }
    });
    observer.observe(readmeDiv, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const splitTextIntoChunks = (text) => {
    const chunks = [];
    let position = 0;
    let count = 1;
    while (position < text.length) {
      let chunk = text.substring(position, position + COPY_LIMIT);
      chunk += REFERENCE_LINK; // Add reference link at the end
      chunks.push(
        `(${count}/${Math.ceil(text.length / COPY_LIMIT)})\n\n` + chunk
      );
      position += COPY_LIMIT;
      count++;
    }
    return chunks;
  };

  const getCurrentVisibleChunks = () => {
    const readmeDiv = document.getElementById("readme");
    const fullText = readmeDiv?.innerText?.trim() || "";

    if (!fullText) {
      return [];
    }

    return splitTextIntoChunks(fullText);
  };

  const handleCopy = () => {
    const visibleChunks = getCurrentVisibleChunks();
    setTextChunks(visibleChunks);

    if (visibleChunks.length === 0) {
      setCopyToast({
        open: true,
        message: "No content to copy",
        severity: "warning",
      });
      return;
    }

    if (copyIndex >= visibleChunks.length) {
      setCopyToast({
        open: true,
        message: "All text has been copied!",
        severity: "info",
      });
      setCopyIndex(0); // Reset index to allow copying again
      return;
    }

    navigator.clipboard
      .writeText(visibleChunks[copyIndex])
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
        setCopyIndex(copyIndex + 1); // Move to the next chunk for the next copy
      })
      .catch((err) => console.error("Failed to copy:", err));
  };

  const handleCloseCopyToast = (_, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setCopyToast((current) => ({ ...current, open: false }));
  };

  
  const handleClickOpen = (imageUrl, imageName) => {
    setSelectedImage(imageUrl);
    setSelectedImageName(imageName || "");
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedImage(null);
    setSelectedImageName("");
    setImageDescription("");
    setChatMessages([]);
    setUserQuestion("");
    setImageBase64Data(null);
  };

  const handleDescribeImage = async () => {
    if (!selectedImage) return;
    setDescribingImage(true);
    setImageDescription("");
    try {
      const imgResponse = await fetch(selectedImage);
      const blob = await imgResponse.blob();
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(blob);
      });

      const mimeType = blob.type || "image/png";
      setImageBase64Data({ base64, mimeType });
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getVisionKey()}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `You are an expert in ancient Egyptian hieroglyphs, Egyptology, and Quranic studies. Describe this image in detail in Arabic.

If the image contains hieroglyphs:
- Act as an expert hieroglyph reader. Carefully read and transliterate every hieroglyphic symbol visible.
- If cartouches are detected, read and translate the names inside them.
- Explain what is written in the hieroglyphs to someone who wants to understand the text.
- The word "nṯr" (netjer) in hieroglyphs represents a FORCE or power, NOT a god. Ancient Egyptians did not believe in gods as deities — they understood these figures as forces and archetypes within the human psyche.

Use the following correspondences between ancient/historical figures and Quranic/religious figures when analyzing the image:
- Imhotep (إمحوتب) = Prophet Joseph (يوسف)
- Nut (نوت) the sky goddess = Noah (نوح)
- Thutmose III (تحتمس الثالث) = Prophet Solomon (سليمان)
- Thutmose II (تحتمس الثاني) = Prophet David (داود)
- Moses (موسى) = Zarathustra/Zoroaster (زرادشت)
- Abraham (إبراهيم) = Socrates (سقراط)
- Plato (أفلاطون) = Ismail (إسماعيل)
- Aristotle (أرسطو) = Isaac (إسحاق)
- Jacob (يعقوب) is NOT Israel
- Lot (لوط) = Buddha (بوذا)
- Mohamed (محمد) = Mani (ماني)
- Akhenaten/Ikhnaton (إخناتون) = Imran (عمران)
- Tutankhamun (توت عنخ آمون) = Yahia/John (يحيى)
- Meritaten (ميريت آتون) = Mother Mary (السيدة مريم)
- Smenkhkare (سمنخ كع رع) = Zakaria (زكريا)

When relevant, explain the image from a Quranic perspective using these correspondences.

Then on a new line prefixed with 'اسم مقترح: ' suggest an Arabic name for this image (less than 15 words). Finally, add a line of relevant hashtags in English.` },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 2000,
        }),
      });

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "No description returned.";
      setImageDescription(content);
      setChatMessages([
        { role: "assistant", content },
      ]);
      setBorderColorIndex((prev) => (prev + 1) % borderColors.length);
    } catch (err) {
      console.error("Failed to describe image:", err);
      setImageDescription("Error: could not describe image.");
    } finally {
      setDescribingImage(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!userQuestion.trim() || !imageBase64Data) return;
    const question = userQuestion.trim();
    setUserQuestion("");
    setAskingQuestion(true);

    const newMessages = [...chatMessages, { role: "user", content: question }];
    setChatMessages(newMessages);

    try {
      const apiMessages = [
        {
          role: "user",
          content: [
            { type: "text", text: "This is an image of an ancient Egyptian artifact. Answer all questions in Arabic." },
            {
              type: "image_url",
              image_url: {
                url: `data:${imageBase64Data.mimeType};base64,${imageBase64Data.base64}`,
              },
            },
          ],
        },
        ...newMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getVisionKey()}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: apiMessages,
          max_tokens: 2000,
        }),
      });

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "No response.";
      setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      setBorderColorIndex((prev) => (prev + 1) % borderColors.length);
    } catch (err) {
      console.error("Failed to ask question:", err);
      setChatMessages((prev) => [...prev, { role: "assistant", content: "حدث خطأ أثناء الإجابة." }]);
    } finally {
      setAskingQuestion(false);
    }
  };

  return (
    <>
      <Header
        id="web-header"
        handleCopy={handleCopy}
        copied={copied}
        copyIndex={copyIndex}
        textChunks={textChunks}
        images={images}
        handleClickOpen={handleClickOpen}
        loading={loadingChunks}
        previewMode={previewMode}
        onTogglePreview={() => setPreviewMode((current) => !current)}
      />
      <div id="print-header" style={{display: 'none'}}></div>
      <Container p={2} mt={2}>
        <Main previewMode={previewMode} images={images} />
      </Container>

      {/* Modal for Enlarged Image */}
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth={imageDescription ? "lg" : "md"}
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            background: "#1a1a2e",
          },
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: imageDescription ? "row" : "column" },
              minHeight: 300,
            }}
          >
            {/* Image side */}
            <Box
              sx={{
                flex: imageDescription ? "0 0 50%" : "1 1 auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "#0f0f23",
                p: 2,
              }}
            >
              {selectedImage && (
                <img
                  src={selectedImage}
                  alt="Large Illustration"
                  className="modal-image-glow"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "65vh",
                    objectFit: "contain",
                    borderRadius: 14,
                    border: "3px solid #00BFA6",
                    boxShadow: "0 0 25px rgba(0, 191, 166, 0.5), 0 0 60px rgba(0, 191, 166, 0.15), 0 10px 40px rgba(0, 0, 0, 0.6)",
                    animation: "imageReveal 0.6s ease-out",
                  }}
                />
              )}
              {/* Image name and action area */}
              <Box
                sx={{
                  width: "100%",
                  mt: 1.5,
                  px: 1,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color: "#aaa",
                    fontFamily: "Roboto, sans-serif",
                    fontSize: "0.85rem",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    mb: 1,
                  }}
                >
                  {selectedImageName}
                </Typography>
                {!imageDescription ? (
                  // Initial Describe button
                  describingImage ? (
                    <CircularProgress size={28} sx={{ color: "#aaa" }} />
                  ) : (
                    <Button
                      onClick={handleDescribeImage}
                      variant="outlined"
                      size="small"
                      startIcon={<AutoAwesomeIcon />}
                      sx={{
                        borderRadius: 5,
                        px: 2,
                        py: 0.5,
                        fontSize: "0.8rem",
                        textTransform: "none",
                        fontFamily: "Roboto, sans-serif",
                        color: "#aaa",
                        borderColor: "#444",
                        "&:hover": {
                          borderColor: "#888",
                          backgroundColor: "rgba(255,255,255,0.05)",
                        },
                      }}
                    >
                      Describe
                    </Button>
                  )
                ) : (
                  // Ask follow-up input
                  <TextField
                    value={userQuestion}
                    onChange={(e) => setUserQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAskQuestion();
                      }
                    }}
                    placeholder="اسأل عن الصورة..."
                    variant="outlined"
                    size="small"
                    fullWidth
                    disabled={askingQuestion}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          {askingQuestion ? (
                            <CircularProgress size={22} sx={{ color: "#aaa" }} />
                          ) : (
                            <IconButton
                              onClick={handleAskQuestion}
                              disabled={!userQuestion.trim()}
                              size="small"
                              sx={{ color: "#aaa" }}
                            >
                              <SendIcon fontSize="small" />
                            </IconButton>
                          )}
                        </InputAdornment>
                      ),
                      sx: {
                        fontFamily: "Roboto, sans-serif",
                        fontSize: "0.9rem",
                        color: "#e0e0e0",
                        borderRadius: 3,
                        "& fieldset": { borderColor: "#444" },
                        "&:hover fieldset": { borderColor: "#888" },
                        "&.Mui-focused fieldset": { borderColor: "#6C63FF" },
                      },
                    }}
                  />
                )}
              </Box>
            </Box>

            {/* Conversation side */}
            {chatMessages.length > 0 && (
              <Box
                sx={{
                  flex: "1 1 50%",
                  p: 3,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  overflow: "auto",
                  maxHeight: "75vh",
                  gap: 2,
                }}
              >
                {chatMessages.map((msg, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      border: msg.role === "assistant" ? 2 : 1,
                      borderColor: msg.role === "assistant"
                        ? borderColors[(borderColorIndex + idx) % borderColors.length]
                        : "#555",
                      borderRadius: 3,
                      p: 2,
                      transition: "border-color 0.5s ease",
                      background: msg.role === "assistant"
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(108,99,255,0.08)",
                    }}
                  >
                    <Typography
                      variant="body1"
                      sx={{
                        color: "#e0e0e0",
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.8,
                        fontSize: "1.05rem",
                        fontFamily: "Roboto, sans-serif",
                      }}
                    >
                      {msg.content}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={copyToast.open}
        autoHideDuration={3000}
        onClose={handleCloseCopyToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseCopyToast}
          severity={copyToast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {copyToast.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default App;
