import { execSync } from 'child_process';

console.log('--- HTTP Diagnostic ---');

const ports = [3000, 3001, 8080];
const paths = ['/', '/api/health', '/login'];

for (const port of ports) {
    // Check if port is open first to avoid long timeouts
    let isPortOpen = false;
    try {
        execSync(`lsof -i :${port} -t`, { stdio: 'ignore' });
        isPortOpen = true;
    } catch (e) {
        isPortOpen = false;
    }

    if (!isPortOpen) {
        console.log(`[SKIP] Port ${port} is closed.`);
        continue;
    }

    console.log(`[TEST] Testing Port ${port}...`);

    for (const path of paths) {
        const url = `http://localhost:${port}${path}`;
        try {
            const start = Date.now();
            // Use curl to get status code and body snippet
            // -s: silent, -o /dev/null: discard body (for status check), -w: write out format
            // We start with a HEAD request or simple GET

            const cmd = `curl -s -w "%{http_code}" -o /tmp/curl_body_${port}.txt "${url}" --max-time 2`;
            const statusCode = execSync(cmd).toString();
            const duration = Date.now() - start;

            let bodySnippet = '';
            try {
                // Read the body file
                bodySnippet = execSync(`cat /tmp/curl_body_${port}.txt`).toString().substring(0, 100).replace(/\n/g, ' ');
            } catch (e) { }

            console.log(`  URL: ${url} | Status: ${statusCode} | Time: ${duration}ms | Body: ${bodySnippet}`);

        } catch (error) {
            console.log(`  URL: ${url} | ERROR: Connection failed or timed out.`);
        }
    }
}
console.log('-----------------------');
