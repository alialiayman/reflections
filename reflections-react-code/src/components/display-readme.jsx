import React, { useEffect, useState } from 'react';
import { GITHUB } from '../constants';
const DisplayReadme = ({path}) => {
  const [readme, setReadme] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (path) {
      const url = `${GITHUB}${path}README.md`;
      console.log(url);
      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error('README.md not found');
          }
          return response.text();
        })
        .then((data) => setReadme(data))
        .catch((err) => setError(err.message));
    } else {
      setError('No path provided');
    }
  }, [path]);

  return (
    <div className="container p-4">
      {error ? (
        <div className="text-red-500">{error}</div>
      ) : (
        <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded-md">
          {readme}
        </pre>
      )}
    </div>
  );
};

export default DisplayReadme;
