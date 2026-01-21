import { execSync } from 'child_process';

console.log('--- Port Diagnostic ---');

try {
    // Find node processes listening on TCP
    const lsofOutput = execSync('lsof -iTCP -sTCP:LISTEN -n -P | grep node || true').toString();

    if (!lsofOutput.trim()) {
        console.log('No Node.js processes found listening on TCP.');
    } else {
        console.log('Node.js processes listening:');
        const lines = lsofOutput.trim().split('\n');
        for (const line of lines) {
            const parts = line.split(/\s+/);
            const command = parts[0];
            const pid = parts[1];
            const node = parts[7]; // TCP *:3000 (LISTEN)
            const portPart = parts[8] || parts[9] || 'unknown'; // Dependendo da versão do lsof

            // Try to get full command
            let fullCommand = 'unknown';
            try {
                fullCommand = execSync(`ps -p ${pid} -o command=`).toString().trim();
            } catch (e) { }

            console.log(`Port: ${portPart} | PID: ${pid} | Command: ${fullCommand.substring(0, 50)}...`);
        }
    }

    // Specifically check common ports
    const commonPorts = [3000, 3001, 8080];
    for (const port of commonPorts) {
        try {
            const check = execSync(`lsof -i :${port} -t`).toString().trim();
            if (check) {
                console.log(`[ALERT] Port ${port} is IN USE by PID(s): ${check.replace(/\n/g, ', ')}`);
            } else {
                console.log(`[INFO] Port ${port} is free.`);
            }
        } catch (e) {
            console.log(`[INFO] Port ${port} is free.`);
        }
    }

} catch (error) {
    console.error('Error running port diagnostic:', error);
}
console.log('-----------------------');
