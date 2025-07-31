const esbuild = require('esbuild');
const { copy } = require('esbuild-plugin-copy');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const isWatch = args.includes('--watch');
const isDev = args.includes('--dev');

const outdir = 'build';

// Ensure build directory exists
if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir, { recursive: true });
}

const buildOptions = {
  entryPoints: ['src/index.tsx'],
  bundle: true,
  outdir,
  platform: 'browser',
  target: ['es2020'],
  format: 'esm',
  splitting: true,
  sourcemap: isDev,
  minify: !isDev,
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
  },
  loader: {
    '.png': 'file',
    '.jpg': 'file',
    '.jpeg': 'file',
    '.gif': 'file',
    '.svg': 'file',
    '.woff': 'file',
    '.woff2': 'file',
    '.eot': 'file',
    '.ttf': 'file',
    '.css': 'css',
  },
  plugins: [
    copy({
      resolveFrom: 'cwd',
      assets: {
        from: ['./public/**/*'],
        to: ['./build'],
      },
      watch: isWatch,
    }),
  ],
  jsx: 'automatic',
  jsxImportSource: 'react',
};

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      
      // Simple dev server
      if (isDev) {
        const serve = await ctx.serve({
          servedir: outdir,
          port: 3002,
          host: 'localhost',
        });
        
        console.log(`🚀 Development server running at http://localhost:${serve.port}`);
        console.log('👀 Watching for changes...');
      }
    } else {
      await esbuild.build(buildOptions);
      console.log('✅ Build completed successfully!');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();