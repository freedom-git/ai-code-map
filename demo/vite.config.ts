import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

function serveProjects(): Plugin {
  const projectsDir = path.resolve(__dirname, '..', 'projects');
  return {
    name: 'serve-projects',
    configureServer(server) {
      server.middlewares.use('/projects', (req, res, next) => {
        const filePath = path.join(projectsDir, req.url ?? '');
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.setHeader('Content-Type', 'application/json');
          fs.createReadStream(filePath).pipe(res);
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveProjects()],
})
