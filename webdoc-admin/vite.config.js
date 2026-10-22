import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function adminBaseRedirect(base) {
  const withoutSlash = base.replace(/\/+$/, '') || '/admin';

  const handle = (req, res, next) => {
    const url = req.url || '';
    if (url === withoutSlash || url.startsWith(`${withoutSlash}?`)) {
      const suffix = url.slice(withoutSlash.length);
      res.writeHead(302, { Location: `${base}${suffix}` });
      res.end();
      return;
    }
    next();
  };

  return {
    name: 'admin-base-redirect',
    configureServer(server) {
      server.middlewares.stack.unshift({ route: '', handle });
    },
    configurePreviewServer(server) {
      server.middlewares.stack.unshift({ route: '', handle });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const adminBaseRaw = env.VITE_ADMIN_BASE || '/admin/';
  const adminBase = `${adminBaseRaw.replace(/\/+$/, '')}/`;
  const apiBase = env.VITE_API_BASE || '/api';

  return {
    base: adminBase,
    plugins: [adminBaseRedirect(adminBase), react()],
    server: {
      port: 5174,
      proxy: {
        [apiBase]: {
          target: 'http://127.0.0.1:18620',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://127.0.0.1:18620',
          changeOrigin: true,
        },
      },
    },
  };
});
