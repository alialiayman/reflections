import { Typography } from '@mui/material';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GITHUB } from '../constants';

const DisplayReadme = ({ path }) => {
    const [readme, setReadme] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        if (path) {
            const url = `${GITHUB}${path === "/" ? path : path + "/"}README.md`;
            axios.get(url, { responseType: 'text' })
                .then((response) => {
                    setReadme(response.data);
                })
                .catch((err) => setError('README.md not found'));
        } else {
            setError('No path provided');
        }
    }, [path]);

    return (
        <div>
            {error ? (
                <Typography color="error">{error}</Typography>
            ) : (
                <div>
                    <Markdown remarkPlugins={[remarkGfm]}>{readme}</Markdown>
                </div>
            )}
        </div>
    );
};

export default DisplayReadme;
