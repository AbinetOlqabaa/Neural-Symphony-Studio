import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDocumentComment,
  createProductionDocument,
  exportDocumentAsJson,
  exportDocumentAsMarkdown,
  exportDocumentAsPrintableHtml,
  exportDocumentAsWordDoc,
  formatLanguageLabel,
  setDocumentStatus,
  updateProductionDocumentWithVersion,
} from './documentSystem';

test('ProductionDocument preserves Tigrigna/Amharic Unicode through versioning and exports', () => {
  const initialText = '# ብዛዕባ ታሪኻዊ ኣኽሱም\n\n**ንዓኻ ሰላም!** Traditional architecture & heritage study.';
  const doc = createProductionDocument({
    type: 'screenplay',
    title: 'Axum Heritage Script — ትግርኛ',
    language: 'ti',
    contentMarkdown: initialText,
    linkedSceneIds: ['scene_intro'],
    linkedCharacterIds: ['char_narrator'],
  });

  assert.equal(doc.version, 1);
  assert.equal(doc.versionHistory.length, 1);
  assert.equal(formatLanguageLabel('ti'), 'Tigrigna (ትግርኛ)');

  const approved = setDocumentStatus(doc, 'approved');
  assert.equal(approved.status, 'approved');

  // Updating content increments version and moves approved status back to in_review cleanly
  const v2 = updateProductionDocumentWithVersion(approved, {
    contentMarkdown: `${initialText}\n\n- Added dawn sequence dialogue.`,
    summary: 'Dawn dialogue revision',
  });
  assert.equal(v2.version, 2);
  assert.equal(v2.versionHistory.length, 2);
  assert.equal(v2.status, 'in_review');

  const withComment = addDocumentComment(v2, 'Linguistic Reviewer', 'Verify Tigrigna phrasing on line 3.');
  assert.equal(withComment.comments.length, 1);

  const md = exportDocumentAsMarkdown(withComment);
  assert.match(md, /ብዛዕባ ታሪኻዊ ኣኽሱም/);
  assert.match(md, /version: 2/);

  const json = JSON.parse(exportDocumentAsJson(withComment));
  assert.equal(json.title, 'Axum Heritage Script — ትግርኛ');

  const html = exportDocumentAsPrintableHtml(withComment);
  assert.match(html, /Noto Sans Ethiopic/);
  assert.match(html, /ብዛዕባ ታሪኻዊ ኣኽሱም/);

  const wordDoc = exportDocumentAsWordDoc(withComment);
  assert.equal(wordDoc.startsWith('\uFEFF'), true);
  assert.match(wordDoc, /urn:schemas-microsoft-com:office:word/);
  assert.match(wordDoc, /ንዓኻ ሰላም!/);
});

test('exportDocumentAsPrintableHtml escapes raw HTML tags safely', () => {
  const doc = createProductionDocument({
    type: 'creative_brief',
    title: '<script>alert(1)</script> Brief',
    contentMarkdown: 'Concept with <img src=x onerror=alert(1)> payload',
  });
  const html = exportDocumentAsPrintableHtml(doc);
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.equal(html.includes('<img src=x'), false);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
