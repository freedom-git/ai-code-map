import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

function serveProjects(): Plugin {
  const projectsDir = path.resolve(__dirname, '..', 'projects');
  return {
    name: 'serve-projects',
    configureServer(server) {
      // API: list all projects
      server.middlewares.use('/api/projects', (_req, res) => {
        if (!fs.existsSync(projectsDir)) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify([]));
          return;
        }
        const projects = fs.readdirSync(projectsDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .filter(d => fs.existsSync(path.join(projectsDir, d.name, 'project.json')))
          .map(d => {
            const config = JSON.parse(fs.readFileSync(path.join(projectsDir, d.name, 'project.json'), 'utf-8'));
            return { id: d.name, ...config };
          });
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(projects));
      });

      // API: list traces for a project
      server.middlewares.use('/api/traces/', (req, res, next) => {
        const projectId = req.url?.replace(/^\//, '').replace(/\/$/, '');
        if (!projectId) { next(); return; }
        const tracesDir = path.join(projectsDir, projectId, 'traces');
        if (!fs.existsSync(tracesDir)) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify([]));
          return;
        }
        const traces = fs.readdirSync(tracesDir)
          .filter(f => f.endsWith('.json'))
          .map(f => f.replace('.json', ''));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(traces));
      });

      // Serve project files
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
