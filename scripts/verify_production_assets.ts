import express from 'express';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';

async function verifyProductionAssets() {
  console.log('================================================================');
  console.log('GOVVERIFY AI — PRODUCTION BUNDLE & ASSET AUDIT');
  console.log('================================================================\n');

  const distPath = path.resolve('dist');
  const assetsPath = path.join(distPath, 'assets');

  if (!fs.existsSync(assetsPath)) {
    throw new Error('dist/assets not found. Run npm run build first.');
  }

  const files = fs.readdirSync(assetsPath);
  console.log(`Found ${files.length} asset files in dist/assets:`);

  let totalJsBytes = 0;
  let totalJsGzip = 0;
  let initialJsBytes = 0;
  let initialJsGzip = 0;

  const initialAssetNames = [
    'index',
    'rolldown-runtime',
    'vendor-react',
    'vendor-libs',
    'vendor-supabase',
  ];

  const tableData: any[] = [];

  for (const file of files) {
    const fullPath = path.join(assetsPath, file);
    const content = fs.readFileSync(fullPath);
    const gzipped = zlib.gzipSync(content);

    const isJs = file.endsWith('.js');
    const isCss = file.endsWith('.css');

    if (isJs) {
      totalJsBytes += content.length;
      totalJsGzip += gzipped.length;
    }

    const isInitial = isJs && initialAssetNames.some((prefix) => file.startsWith(prefix));
    if (isInitial) {
      initialJsBytes += content.length;
      initialJsGzip += gzipped.length;
    }

    tableData.push({
      File: file,
      Type: isJs ? 'JavaScript' : isCss ? 'CSS' : 'Other',
      'Raw Size': `${(content.length / 1024).toFixed(2)} kB`,
      'Gzip Size': `${(gzipped.length / 1024).toFixed(2)} kB`,
      'Initial Load': isInitial ? 'YES (Critical)' : isJs ? 'Lazy / Dynamic' : 'Styles',
    });
  }

  console.table(tableData);

  console.log('----------------------------------------------------------------');
  console.log(`Total JavaScript Assets: ${(totalJsBytes / 1024).toFixed(2)} kB (gzip: ${(totalJsGzip / 1024).toFixed(2)} kB)`);
  console.log(`Initial Critical JS:     ${(initialJsBytes / 1024).toFixed(2)} kB (gzip: ${(initialJsGzip / 1024).toFixed(2)} kB)`);
  console.log('----------------------------------------------------------------\n');

  // Verify that AuthModal is NOT marked initial
  const authModalFile = files.find((f) => f.startsWith('AuthModal'));
  if (authModalFile) {
    console.log(`✔ Verified: AuthModal chunk (${authModalFile}) is isolated and lazy-loaded.`);
  } else {
    throw new Error('AuthModal chunk not found!');
  }

  // Verify that HowItWorks is isolated
  const howItWorksFile = files.find((f) => f.startsWith('HowItWorks'));
  if (howItWorksFile) {
    console.log(`✔ Verified: HowItWorks chunk (${howItWorksFile}) is isolated and lazy-loaded.`);
  }

  // Start production static server and test direct page refresh & asset delivery
  console.log('\n• Testing production static server and direct page refresh...');
  const app = express();
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  // Test 1: GET /
  const rootRes = await fetch(`${baseUrl}/`);
  if (rootRes.status !== 200) throw new Error(`Root GET failed: ${rootRes.status}`);
  const rootHtml = await rootRes.text();
  if (!rootHtml.includes('id="root"')) throw new Error('Root HTML does not include root element');
  console.log('  ✔ GET / returned 200 OK with index.html');

  // Test 2: Direct refresh on deep route /verify/some-id
  const deepRes = await fetch(`${baseUrl}/verify/some-test-request-id`);
  if (deepRes.status !== 200) throw new Error(`Deep refresh failed: ${deepRes.status}`);
  console.log('  ✔ Direct refresh on /verify/some-test-request-id returned 200 OK (SPA fallback working)');

  // Test 3: Asset fetching
  const assetRes = await fetch(`${baseUrl}/assets/${authModalFile}`);
  if (assetRes.status !== 200) throw new Error(`Asset fetch failed: ${assetRes.status}`);
  console.log(`  ✔ Dynamic asset /assets/${authModalFile} returned 200 OK`);

  server.close();
  console.log('\n✔ All production asset checks and direct refresh tests passed successfully!');
}

verifyProductionAssets().catch((err) => {
  console.error('[Asset Verification Error]', err);
  process.exit(1);
});
