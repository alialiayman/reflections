import {
  Container,
  Dialog
} from "@mui/material";
import { useEffect, useState } from "react";
import Header from "./components/header";
import Main from "./components/main";

function App() {
  const [copied, setCopied] = useState(false);
  const [images, setImages] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
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
          const jpgFiles = data
            .filter(
              (file) =>
                file.name.endsWith(".jpg") || file.name.endsWith(".jpeg")
            )
            .map((file) => file.download_url);

          setImages(jpgFiles);
        }
      } catch (error) {
        console.error("Failed to fetch images", error);
      }
    };

    fetchImages();
  }, [path]);

  const handleCopy = () => {
    const readmeDiv = document.getElementById("readme");
    if (readmeDiv) {
      navigator.clipboard
        .writeText(readmeDiv.innerText)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
        })
        .catch((err) => console.error("Failed to copy:", err));
    } else {
      alert("No content to copy");
    }
  };

  const handleClickOpen = (image) => {
    setSelectedImage(image);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedImage(null);
  };

  return (
    <>
      <Header
        handleCopy={handleCopy}
        copied={copied}
        images={images}
        handleClickOpen={handleClickOpen}
      />
      <Container p={2} mt={2}>
        <Main />
      </Container>

      {/* Modal for Enlarged Image */}
      <Dialog open={open} onClose={handleClose}>
        {selectedImage && (
          <img
            src={selectedImage}
            alt="Large Illustration"
            style={{
              maxWidth: "100%",
              maxHeight: "90vh",
              objectFit: "contain",
            }}
          />
        )}
      </Dialog>
    </>
  );
}

export default App;
