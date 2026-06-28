// ── View mode & sidebar toggles ──
(function() {
  var isIframe = window.self !== window.top;
  var root = document.querySelector('.app-root');
  var toggleBtn = document.querySelector('.view-toggle');
  if (!isIframe) root.classList.add('is-expanded');
  toggleBtn.addEventListener('click', function() { root.classList.toggle('is-expanded'); });

  var sidebar = document.querySelector('.notes-sidebar');
  document.querySelector('.sidebar-toggle').addEventListener('click', function() {
    sidebar.classList.toggle('is-collapsed');
    sidebar.classList.remove('is-hidden');
  });
  document.querySelector('.sidebar-hide').addEventListener('click', function() {
    sidebar.classList.add('is-hidden');
    sidebar.classList.remove('is-collapsed');
  });
})();

// ── Notes data & persistence ──
var STORAGE_KEY = 'notenest-notes';
var defaultNotes = [
  {
    id: '1',
    title: 'Reaction Mechanisms',
    html: '<html><head><style>body{font-family:"Newsreader",serif;color:#e8e4d8;background:#0e0e18;padding:20px;line-height:1.92;font-size:14.5px;}h1{font-family:"Cormorant",serif;color:#7c6af5;}</style></head><body><h1>Reaction Mechanisms</h1><p>SN1 and SN2 reactions differ fundamentally.</p></body></html>'
  },
  {
    id: '2',
    title: 'Periodic Trends',
    html: '<html><head><style>body{font-family:"Newsreader",serif;color:#e8e4d8;background:#0e0e18;padding:20px;line-height:1.92;font-size:14.5px;}</style></head><body><h1>Periodic Trends</h1><p>Electronegativity increases across a period.</p></body></html>'
  }
];

var notes = [];
var currentNoteId = null;
var isEditingMarkup = false;

function loadNotes() {
  var stored = localStorage.getItem(STORAGE_KEY);
  notes = stored ? JSON.parse(stored) : defaultNotes;
  saveNotesToStorage();
}
function saveNotesToStorage() { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); }
function getNoteById(id) { return notes.find(function(n) { return n.id === id; }); }
function updateNote(id, updates) {
  var note = getNoteById(id);
  if (note) { Object.assign(note, updates); saveNotesToStorage(); }
}
function createNote(title, html) {
  title = title || 'Untitled Note';
  html = html || '<html><head><style>body{font-family:"Newsreader",serif;color:#e8e4d8;background:#0e0e18;padding:20px;line-height:1.92;font-size:14.5px;}</style></head><body><h1>Untitled Note</h1><p>Start writing…</p></body></html>';
  var id = Date.now().toString(36) + Math.random().toString(36).substr(2,5);
  notes.push({ id: id, title: title, html: html });
  saveNotesToStorage();
  return id;
}

var noteCardList = document.getElementById('note-card-list');
function renderNoteCards() {
  noteCardList.innerHTML = '';
  notes.forEach(function(note) {
    var card = document.createElement('div');
    card.className = 'list-row note-card';
    card.dataset.noteId = note.id;
    card.innerHTML =
      '<div class="note-card__title">' + escHtml(note.title) + '</div>' +
      '<div class="note-card__preview">' + extractPreview(note.html) + '</div>' +
      '<div class="note-card__meta"><span class="label-micro">Today</span><span class="badge badge--violet">tag</span></div>';
    card.addEventListener('click', function() { selectNote(note.id); });
    noteCardList.appendChild(card);
  });
}
function extractPreview(html) {
  var div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').replace(/\s+/g,' ').trim().substring(0,80);
}
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

var noteIframe = document.getElementById('note-iframe');
var noteTitleInput = document.getElementById('note-title-input');
var statusText = document.getElementById('status-text');
var editMarkupBtn = document.getElementById('edit-markup-btn');

var markupEditor   = document.getElementById('markup-editor');
var markupTextarea = document.getElementById('markup-textarea');
var markupSave     = document.getElementById('markup-save');
var markupCancel   = document.getElementById('markup-cancel');

// Summary modal elements
var summaryModal    = document.getElementById('summary-modal');
var summaryTextarea = document.getElementById('summary-textarea');
var summarySave     = document.getElementById('summary-save');
var summaryCancel   = document.getElementById('summary-cancel');
var summaryClose    = document.getElementById('summary-modal-close');

var savedRange = null;
var savedOriginalHtml = null;

// ── Summary container styles injected into iframe head ──
var summaryStyles = `
.note-summary-container {
  position: relative;
  margin: 10px 0;
  padding: 10px 16px;
  border: 2px solid #4caf82;
  border-radius: 20px;
  contenteditable: false;
  user-select: none;
  background: var(--bg-window-alt, #111120);
  transition: background 0.2s, border-color 0.2s, padding 0.2s;
}
.note-summary-container:hover {
  border-color: #66d9a0;
}

.note-summary-tag {
  position: absolute;
  top: -12px;
  left: 16px;
  background: rgba(76,175,130,0.2);
  backdrop-filter: blur(4px);
  border: 1px solid #4caf82;
  border-radius: 12px;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #4caf82;
}

.note-summary-box {
  color: var(--text-primary, #e8e4d8);
  font-style: italic;
}

/* Original content hidden by default, shown in original-view */
.note-summary-original {
  display: none;
}

.note-summary-toggle {
  position: absolute;
  bottom: -12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #0c0c1c;
  border: 1.5px solid #4caf82;
  color: #4caf82;
  display: none;               /* hidden by default, shown on hover in summary view */
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  contenteditable: false;
  user-select: none;
}
.note-summary-container:hover .note-summary-toggle {
  display: flex;
}
.note-summary-toggle:hover {
  background: rgba(76,175,130,0.2);
  color: #fff;
  border-color: #66d9a0;
}

/* Original‑view state */
.note-summary-container.original-view {
  background: transparent;
  border: 1px dashed var(--text-muted, #5a5870);
  border-radius: 8px;
  padding: 4px 8px;
}
.note-summary-container.original-view .note-summary-tag {
  display: none;
}
.note-summary-container.original-view .note-summary-box {
  display: none;
}
.note-summary-container.original-view .note-summary-original {
  display: block;
}
.note-summary-container.original-view .note-summary-toggle {
  display: flex;               /* always visible */
  bottom: auto;
  top: -12px;
  right: -12px;
  background: var(--bg-window-alt, #111120);
  border-color: var(--text-muted, #5a5870);
  color: var(--text-secondary, #9b9888);
}
.note-summary-container.original-view .note-summary-toggle:hover {
  background: var(--accent-violet-bg, rgba(124,106,245,0.1));
  color: var(--accent-violet, #7c6af5);
  border-color: var(--accent-violet-border, rgba(124,106,245,0.28));
}
`;

// ── Enable designMode and inject summary styles ──
function enableIframeEditing() {
  var iframeDoc = noteIframe.contentDocument || noteIframe.contentWindow.document;
  if (iframeDoc && iframeDoc.readyState === 'complete') {
    iframeDoc.designMode = 'on';

    var styleEl = iframeDoc.createElement('style');
    styleEl.textContent = summaryStyles;
    iframeDoc.head.appendChild(styleEl);

    iframeDoc.addEventListener('mouseup', updateToolbarState);
    iframeDoc.addEventListener('keyup', updateToolbarState);
    iframeDoc.addEventListener('selectionchange', updateToolbarState);

    // Delegate click for toggle button
    iframeDoc.addEventListener('click', function(e) {
      var toggle = e.target.closest('.note-summary-toggle');
      if (!toggle) return;
      e.preventDefault();
      e.stopPropagation();

      var container = toggle.closest('.note-summary-container');
      if (!container) return;

      if (container.classList.contains('original-view')) {
        container.classList.remove('original-view');
        toggle.innerHTML = '<i class="ri-sticky-note-line"></i>';
      } else {
        container.classList.add('original-view');
        toggle.innerHTML = '<i class="ri-file-text-line"></i>';
      }
    });

    setTimeout(function() {
      updateToolbarState();
      if (iframeDoc.body) iframeDoc.body.focus();
    }, 0);
  } else {
    setTimeout(enableIframeEditing, 50);
  }
}

// ── Toolbar state ──
function updateToolbarState() {
  var iframeDoc = noteIframe.contentDocument || noteIframe.contentWindow.document;
  if (!iframeDoc) return;

  document.querySelector('[data-command="bold"]')      .classList.toggle('is-active', iframeDoc.queryCommandState('bold'));
  document.querySelector('[data-command="italic"]')    .classList.toggle('is-active', iframeDoc.queryCommandState('italic'));
  document.querySelector('[data-command="underline"]') .classList.toggle('is-active', iframeDoc.queryCommandState('underline'));
  document.querySelector('[data-command="insertUnorderedList"]') .classList.toggle('is-active', iframeDoc.queryCommandState('insertUnorderedList'));
  document.querySelector('[data-command="insertOrderedList"]')   .classList.toggle('is-active', iframeDoc.queryCommandState('insertOrderedList'));

  var headingBtn = document.querySelector('.heading-btn');
  if (headingBtn) {
    var node = iframeDoc.getSelection().anchorNode;
    if (node) {
      var block = node.parentElement.closest('h1,h2,h3,h4,h5,h6');
      headingBtn.classList.toggle('is-active', !!block);
    }
  }
}

function selectNote(id) {
  if (isEditingMarkup) exitMarkupEditor(false);
  if (summaryModal.style.display === 'flex') closeSummaryModal();
  currentNoteId = id;
  var note = getNoteById(id);
  if (!note) return;
  noteTitleInput.value = note.title;
  noteIframe.srcdoc = note.html;
  statusText.textContent = 'All changes saved · 2:14 PM';

  noteIframe.onload = enableIframeEditing;

  document.querySelectorAll('.note-card').forEach(function(c) { c.classList.remove('is-active'); });
  var card = document.querySelector('.note-card[data-note-id="' + id + '"]');
  if (card) card.classList.add('is-active');
  document.getElementById('section-all-count').textContent = notes.length;
}

// ── Toolbar command execution ──
function execOnIframe(command, value) {
  var iframeDoc = noteIframe.contentDocument || noteIframe.contentWindow.document;
  if (!iframeDoc) return;

  if (iframeDoc.designMode !== 'on') {
    iframeDoc.designMode = 'on';
  }

  if (command === 'createLink') {
    value = value || prompt('Enter link URL:', 'https://');
    if (!value) return;
  }

  iframeDoc.execCommand(command, false, value || null);

  if (iframeDoc.body) iframeDoc.body.focus();
  updateToolbarState();
}

document.querySelectorAll('.editor-toolbar [data-command]').forEach(function(btn) {
  btn.addEventListener('click', function(e) {
    e.preventDefault();
    var command = btn.getAttribute('data-command');
    var value   = btn.getAttribute('data-value');
    execOnIframe(command, value);
  });
});

document.querySelectorAll('.heading-options button').forEach(function(btn) {
  btn.addEventListener('click', function(e) {
    e.preventDefault();
    var command = btn.getAttribute('data-command');
    var value   = btn.getAttribute('data-value');
    execOnIframe(command, value);
  });
});

// ── Save button ──
document.getElementById('save-note-btn').addEventListener('click', function() {
  if (isEditingMarkup) return;
  if (!currentNoteId) return;
  try {
    var doc = noteIframe.contentDocument || noteIframe.contentWindow.document;
    var html = doc.documentElement.outerHTML;
    updateNote(currentNoteId, { html: html, title: noteTitleInput.value });
    statusText.textContent = 'All changes saved · just now';
  } catch(e) { statusText.textContent = 'Save failed'; }
});

// ── Markup Editor ──
editMarkupBtn.addEventListener('click', function() {
  if (!currentNoteId) return;
  if (isEditingMarkup) {
    exitMarkupEditor(false);
    return;
  }
  var doc = noteIframe.contentDocument || noteIframe.contentWindow.document;
  if (!doc) { alert('Cannot access iframe content'); return; }
  var currentHtml = doc.documentElement.outerHTML;

  markupTextarea.value = currentHtml;
  noteIframe.style.display = 'none';
  markupEditor.style.display = 'flex';
  isEditingMarkup = true;
  editMarkupBtn.classList.add('is-active');
  editMarkupBtn.innerHTML = '<i class="ri-close-line"></i> Exit Markup';
});

markupSave.addEventListener('click', function() {
  if (!currentNoteId) return;
  var newHtml = markupTextarea.value;
  updateNote(currentNoteId, { html: newHtml });
  exitMarkupEditor(true);
});

markupCancel.addEventListener('click', function() {
  exitMarkupEditor(false);
});

function exitMarkupEditor(reloadNote) {
  isEditingMarkup = false;
  editMarkupBtn.classList.remove('is-active');
  editMarkupBtn.innerHTML = '<i class="ri-code-s-slash-line"></i> Edit Markup';
  markupEditor.style.display = 'none';
  noteIframe.style.display = '';
  if (reloadNote && currentNoteId) {
    selectNote(currentNoteId);
  }
}

// ── Manual Summary ────────────────────────────────
var manualSummaryBtn = document.getElementById('manual-summary-btn');

manualSummaryBtn.addEventListener('click', function() {
  var iframeDoc = noteIframe.contentDocument || noteIframe.contentWindow.document;
  if (!iframeDoc) return;

  var sel = iframeDoc.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) {
    alert('Please select some text first to summarize.');
    return;
  }

  savedRange = sel.getRangeAt(0).cloneRange();
  var contents = savedRange.extractContents();
  var tmp = document.createElement('div');
  tmp.appendChild(contents.cloneNode(true));
  savedOriginalHtml = tmp.innerHTML;
  savedRange.insertNode(contents);   // restore original selection

  summaryTextarea.value = '';
  summaryModal.style.display = 'flex';
  summaryTextarea.focus();
});

function closeSummaryModal() {
  summaryModal.style.display = 'none';
  savedRange = null;
  savedOriginalHtml = null;
}

summarySave.addEventListener('click', function() {
  var summaryText = summaryTextarea.value.trim();
  if (!summaryText) {
    alert('Please write a summary.');
    return;
  }
  if (!savedRange || !savedOriginalHtml) {
    closeSummaryModal();
    return;
  }

  var iframeDoc = noteIframe.contentDocument || noteIframe.contentWindow.document;

  // Build summary container (initial state: summary view)
  var container = iframeDoc.createElement('div');
  container.className = 'note-summary-container';   // starts without original-view
  container.setAttribute('contenteditable', 'false');

  var tag = iframeDoc.createElement('div');
  tag.className = 'note-summary-tag';
  tag.textContent = 'Summary';

  var summaryBox = iframeDoc.createElement('div');
  summaryBox.className = 'note-summary-box';
  summaryBox.textContent = summaryText;

  var originalDiv = iframeDoc.createElement('div');
  originalDiv.className = 'note-summary-original';
  // NO inline display style – CSS controls visibility
  originalDiv.innerHTML = savedOriginalHtml;

  var toggleBtn = iframeDoc.createElement('button');
  toggleBtn.className = 'note-summary-toggle';
  toggleBtn.setAttribute('type', 'button');
  toggleBtn.setAttribute('contenteditable', 'false');
  toggleBtn.innerHTML = '<i class="ri-sticky-note-line"></i>';

  container.appendChild(tag);
  container.appendChild(summaryBox);
  container.appendChild(originalDiv);
  container.appendChild(toggleBtn);

  // Replace the original selected content with the container
  savedRange.deleteContents();
  savedRange.insertNode(container);

  // Collapse selection after the container
  var newRange = iframeDoc.createRange();
  newRange.setStartAfter(container);
  newRange.collapse(true);
  var sel = iframeDoc.getSelection();
  sel.removeAllRanges();
  sel.addRange(newRange);

  closeSummaryModal();
  iframeDoc.body.focus();
});

summaryCancel.addEventListener('click', closeSummaryModal);
summaryClose.addEventListener('click', closeSummaryModal);
document.querySelector('.summary-modal-overlay').addEventListener('click', closeSummaryModal);

// ── New note ──
document.getElementById('new-note-btn').addEventListener('click', function() {
  selectNote(createNote());
  renderNoteCards();
});

// ── Instance tabs & sections ──
document.querySelectorAll('.subject-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.subject-tab').forEach(function(t) { t.classList.remove('is-active'); });
    this.classList.add('is-active');
  });
});
document.querySelectorAll('.section-row').forEach(function(row) {
  row.addEventListener('click', function() {
    document.querySelectorAll('.section-row').forEach(function(r) { r.classList.remove('is-active'); });
    this.classList.add('is-active');
  });
});

// Init
loadNotes();
renderNoteCards();
if (notes.length > 0) selectNote(notes[0].id);