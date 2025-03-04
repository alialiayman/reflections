import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import GitHubIcon from '@mui/icons-material/GitHub';
import HomeIcon from '@mui/icons-material/Home';
import { AppBar, Container, IconButton, Toolbar, Tooltip, Typography, Dialog } from "@mui/material";
import { useState, useEffect } from 'react';
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
          `https://api.github.com/repos/alialiayman/reflections/contents/${path === "/" ? "" : path}?ref=main`
        );
        const data = await response.json();

        if (Array.isArray(data)) {
          const jpgFiles = data
            .filter((file) => file.name.endsWith(".jpg") || file.name.endsWith(".jpeg"))
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
    const readmeDiv = document.getElementById('readme');
    if (readmeDiv) {
      navigator.clipboard.writeText(readmeDiv.innerText)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
        })
        .catch((err) => console.error('Failed to copy:', err));
    } else {
      alert('No content to copy');
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
      <AppBar position="sticky" sx={{
        backgroundColor: '#1B4D3E', // Forest green
        color: '#A4B494', // Dark olive green
      }}>
        <Toolbar className="flex justify-between">

          <div className="flex items-center gap-4">
            <IconButton color="inherit" href="/" aria-label="home">
              <Tooltip title="Home">
                <HomeIcon />
              </Tooltip>
            </IconButton>
            <IconButton color="inherit" href="https://github.com/alialiayman/reflections" target="_blank" aria-label="GitHub">
              <Tooltip title="GitHub">
                <GitHubIcon />
              </Tooltip>
            </IconButton>
          </div>
          <IconButton color="inherit" onClick={handleCopy} aria-label="Copy to Clipboard">
            <Tooltip title="Copy All">
              {!copied ? <ContentCopyIcon /> : <Typography variant='body'>Copied</Typography>}
            </Tooltip>
          </IconButton>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', width: '90%' }}>
            {images.map((image, index) => (
              <img 
                key={index} 
                src={image} 
                alt={`illustration ${index}`} 
                style={{ width: "40px", height: "40px", cursor: "pointer", borderRadius: "5px" }}
                onClick={() => handleClickOpen(image)}
              />
            ))}
          </div>
        </Toolbar>
      </AppBar>
      <Container p={2} mt={2} >
        <Main />
      </Container >

      {/* Modal for Enlarged Image */}
      <Dialog open={open} onClose={handleClose}>
        {selectedImage && (
          <img
            src={selectedImage}
            alt="Large Illustration"
            style={{ maxWidth: "100%", maxHeight: "90vh", objectFit: "contain" }}
          />
        )}
      </Dialog>
    </>
  );
}

export default App;
