import test from 'node:test';
import assert from 'node:assert/strict';
import { publicImageUrl, imageWithinSource } from '../src/lib/image-library.mjs';
import { encryptImageKey, decryptImageKey, listImageKit } from '../src/server/image-provider.mjs';

test('image links stay within the connected HTTPS origin and folder without temporary credentials', () => {
  const base = 'https://ik.imagekit.io/restaurant';
  assert.equal(imageWithinSource('platos/pizza.jpg', base), base + '/platos/pizza.jpg');
  for (const url of ['http://cdn.example.com/a.jpg', 'https://127.0.0.1/a', 'https://[::1]/a', 'https://localhost/a',
    'https://private.local/a', 'https://user:password@cdn.example.com/a', 'https://cdn.example.com/a?token=secret', 'javascript:alert(1)']) {
    assert.throws(() => publicImageUrl(url));
  }
  for (const path of ['../other/a.jpg', '//evil.example.com/a.jpg', base + '-other/a.jpg', 'https://evil.example.com/a.jpg']) {
    assert.throws(() => imageWithinSource(path, base));
  }
});

test('provider keys are encrypted, bound to the business, and fail closed after tampering', () => {
  const previous = process.env.MENUPRO_IMAGE_ENCRYPTION_KEY;
  process.env.MENUPRO_IMAGE_ENCRYPTION_KEY = 'f'.repeat(64);
  try {
    const encrypted = encryptImageKey('private_test-key', 'business-a');
    assert.ok(!encrypted.includes('private_test-key'));
    assert.equal(decryptImageKey(encrypted, 'business-a'), 'private_test-key');
    assert.throws(() => decryptImageKey(encrypted, 'business-b'));
    const fields = encrypted.split('.'); fields[3] = Buffer.from('tampered').toString('base64');
    assert.throws(() => decryptImageKey(fields.join('.'), 'business-a'));
    delete process.env.MENUPRO_IMAGE_ENCRYPTION_KEY;
    assert.throws(() => encryptImageKey('private_test-key', 'business-a'));
  } finally { if (previous === undefined) delete process.env.MENUPRO_IMAGE_ENCRYPTION_KEY; else process.env.MENUPRO_IMAGE_ENCRYPTION_KEY = previous; }
});

test('ImageKit listing uses the fixed API, bounded pagination and hides private, foreign and non-image assets', async () => {
  const baseUrl = 'https://ik.imagekit.io/restaurant';
  const row = { type: 'file', fileType: 'image', fileId: '1', name: 'Pizza', url: baseUrl + '/pizza.jpg' };
  const result = await listImageKit({ privateKey: 'private_key', baseUrl, folder: '/platos', offset: 48 }, async (url, options) => {
    assert.equal(url.origin, 'https://api.imagekit.io');
    assert.equal(url.searchParams.get('limit'), '48');
    assert.equal(url.searchParams.get('skip'), '48');
    assert.equal(url.searchParams.get('path'), '/platos');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from('private_key:').toString('base64'));
    return Response.json([row, { ...row, isPrivateFile: true }, { ...row, url: 'https://evil.example.com/a.jpg' }, { ...row, fileType: 'non-image' }]);
  });
  assert.deepEqual(result, { images: [{ externalId: '1', name: 'Pizza', url: row.url }], nextOffset: null });
  await assert.rejects(() => listImageKit({ privateKey: 'private_key', baseUrl }, async () => new Response('secret provider details', { status: 401 })), /permiso de lectura/);
});
