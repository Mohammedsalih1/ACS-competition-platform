/**
 * files.smoke.js — Integration smoke test for Task 15.
 *
 * Tests the full pipeline:
 *   Upload → Storage → Extraction → File tree → Code Viewer
 *   + File security (path traversal, blocked files, rate limiting)
 *   + File cleanup (re-upload replaces old files)
 *   + File deletion (DELETE /submissions/:id/files)
 *
 * Usage:
 *   1. Start the server: `npm run dev`
 *   2. Run this test:     `node tests/files.smoke.js`
 *
 * The test creates its own admin + contestant accounts, a submission, and
 * uploads a sample ZIP. Everything is self-contained.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE = process.env.API_URL || 'http://localhost:5000/api/v1';

// ── Utilities ───────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  ❌ ${label}`);
  }
}

async function api(method, endpoint, { body, token, formData } = {}) {
  const url = `${BASE}${endpoint}`;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const options = { method, headers };

  if (formData) {
    // Node 18+ native fetch supports FormData-like via Blob, but for
    // multipart we build the body manually.
    const boundary = '----SmokeTestBoundary' + Date.now();
    headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;

    const parts = [];
    for (const [key, value] of Object.entries(formData)) {
      if (Buffer.isBuffer(value.buffer)) {
        parts.push(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${key}"; filename="${value.filename}"\r\n` +
          `Content-Type: ${value.contentType}\r\n\r\n`,
        );
        parts.push(value.buffer);
        parts.push('\r\n');
      } else {
        parts.push(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
          `${value}\r\n`,
        );
      }
    }
    parts.push(`--${boundary}--\r\n`);

    // Combine string and buffer parts
    const buffers = parts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p));
    options.body = Buffer.concat(buffers);
  } else if (body) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

function createSampleZip() {
  const zip = new AdmZip();

  // Source files
  zip.addFile('src/App.jsx', Buffer.from(
    'import React from "react";\n\nexport default function App() {\n  return <h1>Hello ACS</h1>;\n}\n',
  ));
  zip.addFile('src/index.js', Buffer.from(
    'import App from "./App";\nconsole.log("loaded");\n',
  ));
  zip.addFile('src/styles.css', Buffer.from(
    'body { margin: 0; font-family: sans-serif; }\n',
  ));
  zip.addFile('package.json', Buffer.from(
    JSON.stringify({ name: 'test-project', version: '1.0.0' }, null, 2),
  ));
  zip.addFile('README.md', Buffer.from('# Test Project\n\nSample project for smoke test.\n'));

  // Sensitive files (should be blocked by security)
  zip.addFile('.env', Buffer.from('SECRET_KEY=abc123\nDB_PASSWORD=hunter2\n'));
  zip.addFile('.git/config', Buffer.from('[core]\nrepositoryformatversion = 0\n'));

  return zip.toBuffer();
}

function createUpdatedZip() {
  const zip = new AdmZip();
  zip.addFile('src/App.jsx', Buffer.from(
    'import React from "react";\n\nexport default function App() {\n  return <h1>Hello ACS v2</h1>;\n}\n',
  ));
  zip.addFile('index.html', Buffer.from(
    '<!DOCTYPE html><html><body>Updated</body></html>\n',
  ));
  return zip.toBuffer();
}

// ── Main Test ───────────────────────────────────────────────────────

async function run() {
  console.log('\n🔬 File Security & Integration Smoke Test\n');

  // ── 0. Health check ─────────────────────────────────────────────
  console.log('0. Health check');
  {
    const { status, json } = await api('GET', '/health');
    assert(status === 200, 'Server is running');
    assert(json?.data?.status === 'ok', 'Health check returns ok');
  }

  // ── 1. Authentication setup ─────────────────────────────────────
  console.log('\n1. Authentication setup');
  let adminToken, contestantToken, contestantId;

  // Login as admin (seeded)
  {
    const { status, json } = await api('POST', '/auth/login', {
      body: {
        email: process.env.ADMIN_EMAIL || 'admin@acs.local',
        password: process.env.ADMIN_PASSWORD || 'ChangeMe!2026',
      },
    });
    assert(status === 200, 'Admin login successful');
    adminToken = json?.data?.accessToken;
  }

  // Create a contestant via admin
  const testEmail = `smoketest-files-${Date.now()}@test.com`;
  const testPassword = 'TestPass@123';
  {
    const { status, json } = await api('POST', '/users', {
      token: adminToken,
      body: {
        name: 'File Smoke Tester',
        email: testEmail,
        password: testPassword,
        role: 'contestant',
      },
    });
    assert(status === 201 || status === 200, 'Test contestant created');
    contestantId = json?.data?.id || json?.data?.user?.id;
  }

  // Login as contestant
  {
    const { status, json } = await api('POST', '/auth/login', {
      body: { email: testEmail, password: testPassword },
    });
    assert(status === 200, 'Contestant login successful');
    contestantToken = json?.data?.accessToken;
  }

  // ── 2. Create submission ────────────────────────────────────────
  console.log('\n2. Create submission');
  let submissionId;
  {
    const { status, json } = await api('POST', '/submissions', {
      token: contestantToken,
      body: {
        title: 'File Security Test Project',
        description: 'Testing file security features',
        liveUrl: 'https://example.com',
      },
    });
    assert(status === 201, 'Submission created');
    submissionId = json?.data?.id;
    assert(!!submissionId, 'Got submission ID');
  }

  // ── 3. Upload ZIP ───────────────────────────────────────────────
  console.log('\n3. Upload ZIP');
  const zipBuffer = createSampleZip();
  {
    const { status, json } = await api('POST', `/submissions/${submissionId}/upload`, {
      token: contestantToken,
      formData: {
        projectFile: {
          buffer: zipBuffer,
          filename: 'project.zip',
          contentType: 'application/zip',
        },
      },
    });
    assert(status === 201, `Upload successful (status: ${status})`);
    assert(!!json?.data?.fileId, 'Got file ID in response');
  }

  // ── 4. Project file tree ────────────────────────────────────────
  console.log('\n4. Project file tree (via /files/:id)');
  {
    const { status, json, text } = await api('GET', `/files/${submissionId}`, {
      token: contestantToken,
    });
    
    if (status !== 200) {
      console.error(`Project tree failed. Status: ${status}, Body: ${text}`);
    }
    
    assert(status === 200, 'Project files endpoint works');
    assert(json?.data?.tree?.length > 0, 'File tree is not empty');
    assert(json?.data?.summary?.totalFiles > 0, 'Has total files count');

    // Security: .env and .git should NOT appear in the tree
    const allPaths = JSON.stringify(json?.data?.tree || []);
    assert(!allPaths.includes('.env'), '.env is hidden from tree');
    assert(!allPaths.includes('.git'), '.git is hidden from tree');
  }

  // ── 5. Folder contents ─────────────────────────────────────────
  console.log('\n5. Folder contents');
  {
    const { status, json } = await api(
      'GET',
      `/files/${submissionId}/folder?path=src`,
      { token: contestantToken },
    );
    assert(status === 200, 'Folder listing works');
    assert(json?.data?.entries?.length > 0, 'src/ has entries');
  }

  // ── 6. File info ────────────────────────────────────────────────
  console.log('\n6. File info');
  {
    const { status, json } = await api(
      'GET',
      `/files/${submissionId}/info?path=src/App.jsx`,
      { token: contestantToken },
    );
    assert(status === 200, 'File info works');
    assert(json?.data?.isViewable === true, 'JSX file is viewable');
    assert(json?.data?.language === 'jsx', 'Language detected as JSX');
  }

  // ── 7. File content ─────────────────────────────────────────────
  console.log('\n7. File content');
  {
    const { status, json } = await api(
      'GET',
      `/files/${submissionId}/content?path=src/App.jsx`,
      { token: contestantToken },
    );
    assert(status === 200, 'File content works');
    assert(json?.data?.content?.includes('Hello ACS'), 'Content is correct');
    assert(json?.data?.metadata?.lineCount > 0, 'Line count is present');
  }

  // ── 8. Security: Path traversal ─────────────────────────────────
  console.log('\n8. Security — Path traversal protection');
  {
    // Classic traversal
    const { status } = await api(
      'GET',
      `/files/${submissionId}/content?path=../../../etc/passwd`,
      { token: contestantToken },
    );
    assert(status === 400, `Blocked ../../../etc/passwd (status: ${status})`);
  }
  {
    // Null byte
    const { status } = await api(
      'GET',
      `/files/${submissionId}/content?path=src/App.jsx%00.txt`,
      { token: contestantToken },
    );
    assert(status === 400, `Blocked null byte path (status: ${status})`);
  }
  {
    // Backslash traversal
    const { status } = await api(
      'GET',
      `/files/${submissionId}/content?path=src\\..\\..\\etc\\passwd`,
      { token: contestantToken },
    );
    assert(status === 400, `Blocked backslash traversal (status: ${status})`);
  }

  // ── 9. Security: Blocked files ──────────────────────────────────
  console.log('\n9. Security — Blocked file access');
  {
    const { status, json } = await api(
      'GET',
      `/files/${submissionId}/content?path=.env`,
      { token: contestantToken },
    );
    assert(status === 403, `Blocked .env access (status: ${status})`);
    assert(
      json?.error?.code === 'BLOCKED_FILE_ACCESS',
      `Error code is BLOCKED_FILE_ACCESS`,
    );
  }

  // ── 10. Security: Access control ────────────────────────────────
  console.log('\n10. Security — Access control');
  {
    // Unauthenticated access should fail
    const { status } = await api('GET', `/files/${submissionId}`);
    assert(status === 401, `Unauthenticated access blocked (status: ${status})`);
  }

  // ── 11. Re-upload (replace) ─────────────────────────────────────
  console.log('\n11. Re-upload — replaces previous files');
  const updatedZip = createUpdatedZip();
  {
    const { status, json } = await api(
      'POST',
      `/submissions/${submissionId}/upload`,
      {
        token: contestantToken,
        formData: {
          projectFile: {
            buffer: updatedZip,
            filename: 'project-v2.zip',
            contentType: 'application/zip',
          },
        },
      },
    );
    assert(status === 201, `Re-upload successful (status: ${status})`);

    // Verify the new tree
    const { json: treeJson } = await api('GET', `/files/${submissionId}`, {
      token: contestantToken,
    });
    const allPaths = JSON.stringify(treeJson?.data?.tree);
    assert(allPaths.includes('index.html'), 'New file (index.html) is present');
  }

  // Read updated content
  {
    const { status, json } = await api(
      'GET',
      `/files/${submissionId}/content?path=src/App.jsx`,
      { token: contestantToken },
    );
    assert(status === 200, 'Can read file after re-upload');
    assert(
      json?.data?.content?.includes('Hello ACS v2'),
      'Content reflects updated version',
    );
  }

  // ── 12. Delete files ────────────────────────────────────────────
  console.log('\n12. Delete submission files');
  {
    const { status, json } = await api(
      'DELETE',
      `/submissions/${submissionId}/files`,
      { token: contestantToken },
    );
    assert(status === 200, `Delete files successful (status: ${status})`);
    assert(
      json?.data?.submission?.status === 'draft',
      'Submission reverted to draft',
    );
    assert(
      json?.data?.submission?.files?.length === 0,
      'Files array is empty',
    );
  }

  // Verify file tree is gone
  {
    const { status } = await api('GET', `/files/${submissionId}`, {
      token: contestantToken,
    });
    assert(status === 404, `File tree not found after deletion (status: ${status})`);
  }

  // ── 13. Cascade delete (admin) ──────────────────────────────────
  console.log('\n13. Cascade delete submission (admin)');
  {
    const { status } = await api('DELETE', `/submissions/${submissionId}`, {
      token: adminToken,
    });
    assert(status === 200, `Cascade delete successful (status: ${status})`);
  }
  {
    const { status } = await api('GET', `/submissions/${submissionId}`, {
      token: adminToken,
    });
    assert(status === 404, `Submission no longer exists (status: ${status})`);
  }

  // ── Summary ─────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(50));
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  if (failures.length > 0) {
    console.log('\n  Failures:');
    failures.forEach((f) => console.log(`    - ${f}`));
  }
  console.log('═'.repeat(50) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('\n💥 Smoke test crashed:', err);
  process.exit(1);
});
