import path from 'path';

/** @type {import('lint-staged').Config} */
export default {
  'backend/**/*.ts': (files) => {
    const relative = files.map((f) => path.relative('backend', f)).join(' ');
    return [
      `bash -c 'cd backend && npx eslint --fix ${relative}'`,
      `bash -c 'cd backend && npx prettier --write ${relative}'`,
    ];
  },
  'frontend/**/*.{ts,tsx}': (files) => {
    const relative = files.map((f) => path.relative('frontend', f)).join(' ');
    return [
      `bash -c 'cd frontend && npx eslint --fix ${relative}'`,
      `bash -c 'cd frontend && npx prettier --write ${relative}'`,
    ];
  },
};
