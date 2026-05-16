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

      // API: save node positions into map.json or trace file
      server.middlewares.use('/api/save-positions/', (req, res, next) => {
        const urlParts = (req.url ?? '').replace(/^\//, '').split('/');
        const projectId = urlParts[0];
        const target = urlParts[1]; // 'map' or 'trace'
        const traceName = urlParts[2]; // only for trace
        if (!projectId || !target) { next(); return; }

        // DELETE — remove trace positions
        if (req.method === 'DELETE') {
          if (target === 'trace' && traceName) {
            const traceFile = path.join(projectsDir, projectId, 'traces', `${traceName}.json`);
            if (!fs.existsSync(traceFile)) { res.statusCode = 404; res.end('{}'); return; }
            const traceData = JSON.parse(fs.readFileSync(traceFile, 'utf-8'));
            delete traceData.positions;
            fs.writeFileSync(traceFile, JSON.stringify(traceData, null, 2));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } else {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Only trace positions can be reset' }));
          }
          return;
        }

        if (req.method !== 'PUT') { next(); return; }

        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const positions = JSON.parse(body);

            if (target === 'map') {
              const mapFile = path.join(projectsDir, projectId, 'map.json');
              if (!fs.existsSync(mapFile)) { res.statusCode = 404; res.end('{}'); return; }
              const mapData = JSON.parse(fs.readFileSync(mapFile, 'utf-8'));
              for (const node of mapData.nodes) {
                const pos = positions[node.id];
                if (pos) { node.x = pos.x; node.y = pos.y; }
              }
              for (const folder of (mapData.folders ?? [])) {
                const pos = positions[folder.id];
                if (pos) { folder.x = pos.x; folder.y = pos.y; }
              }
              fs.writeFileSync(mapFile, JSON.stringify(mapData, null, 2));
            } else if (target === 'trace' && traceName) {
              const traceFile = path.join(projectsDir, projectId, 'traces', `${traceName}.json`);
              if (!fs.existsSync(traceFile)) { res.statusCode = 404; res.end('{}'); return; }
              const traceData = JSON.parse(fs.readFileSync(traceFile, 'utf-8'));
              traceData.positions = positions;
              fs.writeFileSync(traceFile, JSON.stringify(traceData, null, 2));
            } else {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid target' }));
              return;
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
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
