import { Typography } from '@mui/material';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GITHUB } from '../constants';

const DisplayReadme = ({ path, filename = 'README.md' }) => {
    const [content, setContent] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        if (path && filename) {
            const url = `${GITHUB}${path.endsWith('/') ? path : path + '/'}${filename}`;
            axios.get(url, { responseType: 'text' })
                .then((response) => {
                    setContent(response.data);
                })
                .catch(() => setError(`${filename} not found`));
        } else {
            setError('No path or filename provided');
        }
    }, [path, filename]);

    return (
        <div>
            {error ? (
                <Typography color="error">{error}</Typography>
            ) : (
                <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
            )}
        </div>
    );
};

export default DisplayReadme;
