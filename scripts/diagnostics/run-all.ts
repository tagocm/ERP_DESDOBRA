import { execSync } from 'child_process';
import fs from 'fs';

const reportPath = 'diagnostics-report.md';
let reportContent = `# Diagnostics Report
Date: ${new Date().toISOString()}
Node Version: ${process.version}

`;

function runStep(name: string, command: string): string {
    console.log(`Running ${name}...`);
    try {
        const output = execSync(command).toString();
        console.log(output);
        return `## ${name}\n\`\`\`\n${output}\n\`\`\`\n\n`;
    } catch (error: any) {
        console.error(`Error in ${name}:`, error.message);
        return `## ${name}\nERROR: ${error.message}\n\n`;
    }
}

// 1. Env
reportContent += runStep('Environment Check', 'npm run diag:env');

// 2. Ports
reportContent += runStep('Port Check', 'npm run diag:ports');

// 3. Build (Optional)
if (process.argv.includes('--build')) {
    console.log('Running Build...');
    try {
        execSync('npm run build', { stdio: 'pipe' }); // Pipe to capture if we want, but usually build is huge.
        reportContent += `## Build Status\nSuccess\n\n`;
    } catch (error: any) {
        console.error('Build Failed');
        const stderr = error.stderr ? error.stderr.toString() : 'Unknown error';
        const lastLines = stderr.split('\n').slice(-30).join('\n');
        reportContent += `## Build Status\nFAILED\n\n### Last 30 lines of error\n\`\`\`\n${lastLines}\n\`\`\`\n\n`;
    }
} else {
    reportContent += `## Build Status\nSkipped (use --build to run)\n\n`;
}

// 4. HTTP (Run last to ensure server had chance to start if we were starting it, but here we assume it IS running)
// The user prompt implies we are diagnosing why it hangs, so it might be running.
reportContent += runStep('HTTP Check', 'npm run diag:http');

// Conclusion logic (Simple heuristic)
reportContent += `## Conclusion\n`;
reportContent += `- See sections above for details.\n`;

fs.writeFileSync(reportPath, reportContent);
console.log(`Report generated at ${reportPath}`);
