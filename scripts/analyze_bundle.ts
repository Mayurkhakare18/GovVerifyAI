import fs from 'fs';
import path from 'path';

const distPath = path.resolve('dist/assets');
if (fs.existsSync(distPath)) {
  const files = fs.readdirSync(distPath);
  console.log('Files in dist/assets:', files);
  for (const file of files) {
    const filePath = path.join(distPath, file);
    const stat = fs.statSync(filePath);
    console.log(`- ${file}: ${(stat.size / 1024).toFixed(2)} kB (${stat.size} bytes)`);
  }
}

function walk(dir: string): Array<{ path: string; size: number }> {
  let results: Array<{ path: string; size: number }> = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      results = results.concat(walk(p));
    } else {
      results.push({ path: p, size: fs.statSync(p).size });
    }
  }
  return results;
}

const all = walk('src');
all.sort((a, b) => b.size - a.size);
console.log('\nTop 20 Largest Source Files in src:');
for (const item of all.slice(0, 20)) {
  console.log(`  ${(item.size / 1024).toFixed(2)} kB\t${item.path}`);
}
