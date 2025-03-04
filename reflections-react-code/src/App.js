import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import GitHubIcon from '@mui/icons-material/GitHub';
import HomeIcon from '@mui/icons-material/Home';
import { AppBar, Container, IconButton, Toolbar, Tooltip, Typography } from "@mui/material";
import { useState } from 'react';
import Main from "./components/main";

function App() {
  const [copied, setCopied] = useState(false);

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
        </Toolbar>
      </AppBar>
      <Container p={2} mt={2} >
        <Main />
      </Container >
    </>

  );
}

export default App;