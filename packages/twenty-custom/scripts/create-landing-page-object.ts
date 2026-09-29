import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const WORKSPACE_ID = 'df39adb9-e73a-446a-83f9-59d443216526';
const APP_SECRET = 'replace_me_with_a_random_string';
const API_KEY_ID = '1afeb524-0d80-4d8c-adfd-384d8f789398';

const key = createHash('sha256').update(`${APP_SECRET}${WORKSPACE_ID}API_KEY`).digest('hex');

const token = jwt.sign(
  { sub: WORKSPACE_ID, type: 'API_KEY', workspaceId: WORKSPACE_ID, jti: API_KEY_ID },
  key,
  { algorithm: 'HS256', expiresIn: '100y' }
);

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
});

async function main() {
  const objectId = '9a336842-0157-49c6-85bf-beed16772665';

  const existingFields = new Set([
    'createdAt', 'updatedBy', 'id', 'timelineActivities', 'createdBy',
    'name', 'searchVector', 'lpSlug', 'position', 'deletedAt'
  ]);

  const fieldsToCreate = [
    { name: 'lpTitle', label: 'Title', type: 'TEXT', nullable: false },
    { name: 'lpBrief', label: 'Brief', type: 'TEXT', nullable: true },
    { name: 'lpPresetId', label: 'Preset ID', type: 'TEXT', nullable: false },
    { name: 'lpCustomHtml', label: 'Custom HTML', type: 'TEXT', nullable: true },
    { name: 'lpPublished', label: 'Published', type: 'BOOLEAN', nullable: false },
    { name: 'lpPublishedUrl', label: 'Published URL', type: 'TEXT', nullable: true },
    { name: 'lpPublishedAt', label: 'Published At', type: 'DATE_TIME', nullable: true },
    { name: 'lpSubmissions', label: 'Submissions', type: 'NUMBER', nullable: true },
  ];

  for (const f of fieldsToCreate) {
    if (existingFields.has(f.name)) {
      console.log(`Field ${f.name}: already exists, skipping`);
      continue;
    }
    const r = await client.post('/metadata', {
      query: `mutation { createOneField(input: { field: { objectMetadataId: "${objectId}", name: "${f.name}", label: "${f.label}", type: ${f.type}, isNullable: ${f.nullable} } }) { id name } }`,
    });
    if (r.data.errors) {
      console.error(`Error creating ${f.name}:`, JSON.stringify(r.data.errors).slice(0, 300));
    } else {
      console.log(`Field ${f.name}:`, r.data.data.createOneField.id);
    }
  }

  console.log('\nlandingPage objectId:', objectId);
}

main().catch(console.error);
