const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.nav');
menuButton?.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
});
document.querySelectorAll('.nav a').forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuButton?.setAttribute('aria-expanded', 'false');
  });
});
// Store each art form's files locally, including binary file contents.
const addFileButton = document.querySelector('#add-file');
if (document.querySelector('#file-search')) {
  const input = document.querySelector('#file-input');
  const status = document.querySelector('#upload-status') || document.querySelector('#search-status');
  const list = document.querySelector('.assignments .assignments-list');
  const subject = document.querySelector('#subject-title')?.textContent.trim();
  const emptyState = list?.firstElementChild?.cloneNode(true);
  const publicFiles = [
    { id: 'public-photo', name: 'CKV-collage.jpg', subject: 'Mijn opdrachten', url: 'photo_2026-11-01_22-08-55.jpg', addedAt: 1793577600000, file: { size: 157903, type: 'image/jpeg' } },
    { id: 'public-ckv-new', name: 'CKV CZP verslag.pdf', subject: 'Mijn opdrachten', url: '69fee023-5ec6-438b-8854-d4e3b5f786db_CKV_CZP_verslag.pdf', addedAt: 1793577600001, file: { size: 5386866, type: 'application/pdf' } },
    { id: 'public-banksy', name: 'Banksy opdrachten.pdf', subject: 'Mijn opdrachten', url: '7094285f-47f3-4fd1-9875-b4127c6942c1_Banksy_opdrachten_.pdf', addedAt: 1793577600002, file: { size: 1753838, type: 'application/pdf' } },
    { id: 'public-cap', name: 'CAP.pdf', subject: 'Mijn opdrachten', url: 'c243f0e8-3c0c-4d9f-87be-3fda1c0690ba_CAP_.pdf', addedAt: 1793577600003, file: { size: 85333, type: 'application/pdf' } }
  ];
  const urls = [];
  let db;
  if (addFileButton) addFileButton.disabled = true;

  function transaction(mode, action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', mode);
      const request = action(tx.objectStore('files'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Opslaan onderbroken'));
    });
  }

  function openFile(record) {
    window.location.href = 'bestand.html?bestand=' + encodeURIComponent(record.id);
  }

  async function renderPdfPages(url, container, message) {
    try {
      const base = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/';
      const pdfjs = await import('./vendor/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', window.location.href).href;
      const pdf = await pdfjs.getDocument({ url, cMapUrl: base + 'cmaps/', cMapPacked: true, standardFontDataUrl: base + 'standard_fonts/', wasmUrl: base + 'wasm/' }).promise;
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number);
        const original = page.getViewport({ scale: 1 });
        const width = Math.min(container.clientWidth || 900, 1050);
        const viewport = page.getViewport({ scale: width / original.width });
        const section = document.createElement('section');
        section.className = 'pdf-page';
        section.setAttribute('aria-label', `Pagina ${number} van ${pdf.numPages}`);
        section.style.aspectRatio = `${original.width} / ${original.height}`;
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        section.append(canvas);
        container.append(section);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [ratio, 0, 0, ratio, 0, 0] }).promise;
        const text = await page.getTextContent();
        const accessibleText = document.createElement('div');
        accessibleText.className = 'sr-only';
        accessibleText.textContent = text.items.map((item) => item.str || '').join(' ');
        section.append(accessibleText);
        message.textContent = `Pagina ${number} van ${pdf.numPages} geladen...`;
        page.cleanup();
      }
      message.textContent = `${pdf.numPages} pagina’s · Scroll naar beneden om de hele opdracht te lezen.`;
      await pdf.destroy();
    } catch (error) {
      message.textContent = 'De opdracht kon niet volledig worden geladen. Vernieuw de pagina of gebruik Downloaden.';
      console.error('PDF laden mislukt:', error);
    }
  }
  let documentObjectUrl;
  let displayedId;
  async function showDocument() {
    const content = document.querySelector('#document-content');
    if (!content) return;
    const id = new URLSearchParams(window.location.search).get('bestand');
    const record = searchRecords.find((item) => String(item.id) === id);
    const title = document.querySelector('#document-title');
    const message = document.querySelector('#document-status');
    if (!record) {
      title.textContent = 'Bestand niet gevonden';
      message.textContent = 'Dit bestand is verwijderd of alleen beschikbaar in de browser waarin het is toegevoegd.';
      return;
    }
    if (displayedId === record.id) return;
    displayedId = record.id;
    title.textContent = record.name;
    document.title = record.name + ' | Lex CKV';
    document.querySelector('#document-back').href = 'opdrachten.html?bestand=' + encodeURIComponent(record.id);
    const extension = record.name.split('.').pop().toLowerCase();
    const type = record.file.type;
    const isPdf = type === 'application/pdf' || extension === 'pdf';
    const url = record.url || URL.createObjectURL(isPdf ? record.file.slice(0, record.file.size, 'application/pdf') : record.file);
    if (!record.url) documentObjectUrl = url;
    const download = document.querySelector('#document-download');
    download.href = url;
    download.download = record.name;
    download.hidden = false;
    content.replaceChildren();
    let element;
    if (isPdf) {
      element = document.createElement('div');
      element.className = 'pdf-pages';
      message.textContent = 'Opdracht laden...';
      renderPdfPages(url, element, message);
    } else if (type.startsWith('image/') || /^(png|jpe?g|gif|webp|avif|bmp|svg)$/.test(extension)) {
      element = document.createElement('img');
      element.src = url;
      element.alt = record.name;
    } else if (type.startsWith('video/') || type.startsWith('audio/')) {
      element = document.createElement(type.startsWith('video/') ? 'video' : 'audio');
      element.controls = true;
      element.src = url;
    } else if (type.startsWith('text/') || /^(txt|md|csv|json)$/.test(extension)) {
      element = document.createElement('pre');
      element.textContent = 'Tekst laden...';
      record.file.text().then((text) => { element.textContent = text; }).catch(() => {
        element.textContent = 'De tekst kon niet worden geladen. Je kunt het bestand downloaden.';
      });
    } else {
      element = document.createElement('p');
      element.textContent = 'Dit bestandstype kan de browser niet tonen. Download het bestand of voeg een pdf-versie toe.';
    }
    element.addEventListener('error', () => { message.textContent = 'Weergeven is niet gelukt. Gebruik Downloaden om het bestand te openen.'; });
    content.append(element);
    if (record.url) {
      try { localStorage.setItem('lex-opened-' + record.id, String(Date.now())); } catch {}
    } else if (db) {
      transaction('readwrite', (store) => {
        const request = store.get(record.id);
        request.onsuccess = () => { if (request.result) store.put({ ...request.result, lastOpenedAt: Date.now() }); };
        return request;
      }).catch(() => {});
    }
  }
  window.addEventListener('pagehide', () => { if (documentObjectUrl) URL.revokeObjectURL(documentObjectUrl); });
  const searchInput = document.querySelector('#file-search');
  const searchStatus = document.querySelector('#search-status');
  const searchResults = document.querySelector('#search-results');
  let searchRecords = [...publicFiles];
  searchInput.disabled = false;
  const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('nl-NL');
  function searchFiles() {
    searchResults.replaceChildren();
    const query = normalize(searchInput.value.trim());
    if (!query) {
      searchStatus.textContent = 'Typ een bestandsnaam om in mijn opdrachten te zoeken.';
      return;
    }
    const matches = searchRecords.filter((record) => normalize(record.name).includes(query));
    searchStatus.textContent = matches.length ? `${matches.length} bestand(en) gevonden.` : 'Geen bestanden gevonden. Probeer een andere bestandsnaam.';
    matches.forEach((record) => {

      const link = document.createElement('a');
      link.className = 'file-row search-result-link';
      link.href = `${'opdrachten.html'}?bestand=${encodeURIComponent(record.id)}`;
      const details = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = record.name;
      const category = document.createElement('p');
      category.textContent = 'Mijn opdrachten';
      details.append(title, category);
      const arrow = document.createElement('span');
      arrow.textContent = '\u2192';
      arrow.setAttribute('aria-hidden', 'true');
      link.append(details, arrow);
      searchResults.append(link);
    });
  }
  searchInput.addEventListener('input', searchFiles);
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const first = searchResults.querySelector('a');
      if (first) { event.preventDefault(); first.click(); }
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      searchResults.querySelector('a')?.focus();
    }
    if (event.key === 'Escape') {
      searchInput.value = '';
      searchFiles();
    }
  });
  searchFiles();
  const sortSelect = document.querySelector('#file-sort');
  const nameOrder = new Intl.Collator('nl', { numeric: true, sensitivity: 'base' });
  function compareFiles(a, b) {
    // Auto-incremented IDs preserve the original upload order, including older files.
    const newest = (b.addedAt || Number(b.id) || 0) - (a.addedAt || Number(a.id) || 0);
    switch (sortSelect?.value) {
      case 'oldest': return -newest;
      case 'recent': return ((b.lastOpenedAt || 0) - (a.lastOpenedAt || 0)) || newest;
      case 'largest': return (b.file.size - a.file.size) || newest;
      case 'smallest': return (a.file.size - b.file.size) || newest;
      case 'az': return nameOrder.compare(a.name, b.name) || newest;
      case 'za': return nameOrder.compare(b.name, a.name) || newest;
      default: return newest;
    }
  }
  sortSelect?.addEventListener('change', () => {
    renderFiles().catch(() => { status.textContent = 'Sorteren is niet gelukt. Probeer het opnieuw.'; });
  });
  async function renderFiles() {
    const localFiles = db ? await transaction('readonly', (store) => store.getAll()) : [];
    // Hide only known retired uploads; leave other browser files untouched.
    const retiredUploads = [
      { name: 'CKV CZP verslag.pdf', size: 621879 },
      { name: 'CKV CZP verslag (eerdere upload).pdf', size: 621879 },
      { name: 'photo_2026-10-19_08-13-48.jpg', size: 157903 }
    ];
    const records = [...publicFiles, ...localFiles.filter((file) =>
      !retiredUploads.some((old) => old.name === file.name && old.size === file.file.size)
    )];
    searchInput.disabled = false;
    for (const record of publicFiles) {
      try { record.lastOpenedAt = Number(localStorage.getItem('lex-opened-' + record.id)) || 0; } catch {}
    }
    searchRecords = records;
    await showDocument();
    searchFiles();
    const count = document.querySelector('#file-count');
    if (count) count.textContent = records.length;
    if (!list) return;
    urls.splice(0).forEach((url) => URL.revokeObjectURL(url));
    list.replaceChildren();
    const files = records.slice().sort(compareFiles);
    if (!files.length && emptyState) list.append(emptyState.cloneNode(true));
    files.forEach((record) => {
      const row = document.createElement('article');
      row.className = 'file-row';
      row.id = 'bestand-' + record.id;
      row.tabIndex = 0;
      row.setAttribute('aria-label', record.name + '. Klik om te selecteren; dubbelklik of druk op Enter om te openen.');
      function selectFile() {
        list.querySelectorAll('.selected-file').forEach((item) => item.classList.remove('selected-file'));
        row.classList.add('selected-file');
      }
      row.addEventListener('click', (event) => {
        if (event.target.closest('button, a')) return;
        selectFile();
      });
      row.addEventListener('dblclick', (event) => {
        if (event.target.closest('button, a')) return;
        selectFile();
        openFile(record);
      });
      row.addEventListener('keydown', (event) => {
        if (event.target !== row) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectFile();
          if (event.key === 'Enter' && !event.repeat) openFile(record);
        }
      });
      const details = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = record.name;
      const size = document.createElement('p');
      size.textContent = `${(record.file.size / 1024 / 1024).toLocaleString('nl-NL', { maximumFractionDigits: 2 })} MB`;
      details.append(title, size);
      const actions = document.createElement('div');
      actions.className = 'file-actions';
      const download = document.createElement('a');
      const url = record.url || URL.createObjectURL(record.file);
      if (!record.url) urls.push(url);
      download.href = url;
      download.download = record.name;
      download.className = 'file-icon-action';
      download.title = 'Downloaden';
      download.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>';
      download.setAttribute('aria-label', `${record.name} downloaden`);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'file-icon-action file-delete';
      remove.title = 'Verwijderen';
      remove.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg>';
      remove.setAttribute('aria-label', `${record.name} verwijderen`);
      remove.addEventListener('click', async () => {
        if (!window.confirm(`Wil je ${record.name} uit dit portfolio verwijderen?`)) return;
        remove.disabled = true;
        try {
          await transaction('readwrite', (store) => store.delete(record.id));
          await renderFiles();
          status.textContent = 'Bestand verwijderd.';
          addFileButton.focus();
        } catch {
          status.textContent = 'Verwijderen is niet gelukt. Probeer het opnieuw.';
          remove.disabled = false;
        }
      });
      actions.append(download);
      if (!record.url) actions.append(remove);
      const cover = document.createElement('div');
      cover.className = 'file-thumbnail';
      if (record.file.type.startsWith('image/')) {
        const image = document.createElement('img');
        image.src = url;
        image.alt = '';
        image.loading = 'lazy';
        cover.append(image);
      } else {
        cover.textContent = record.name.split('.').pop().toUpperCase();
      }
      row.append(cover, details, actions);
      list.append(row);
    });
  }

  async function initialize() {
    try {
      db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('lex-ckv-portfolio', 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => { status.textContent = 'Sluit andere portfolio-tabbladen en vernieuw deze pagina.'; };
      });
      await renderFiles();
      const requestedId = new URLSearchParams(window.location.search).get('bestand');
      if (requestedId && subject) {
        const record = searchRecords.find((item) => String(item.id) === requestedId);
        if (record) {
          const row = document.getElementById('bestand-' + record.id);
          row?.classList.add('selected-file');
          row?.scrollIntoView({ block: 'center' });
          row?.focus({ preventScroll: true });

        } else {
          status.textContent = 'Dit bestand is niet meer beschikbaar in deze browser.';
        }
      }
      if (addFileButton) addFileButton.disabled = false;
    } catch {
      db = null;
      await renderFiles();
      status.textContent = 'Deze browser kan bestanden hier niet bewaren. Open de website in een normale browser met lokale opslag ingeschakeld.';
    }
  }

  addFileButton?.addEventListener('click', () => input.click());
  input?.addEventListener('change', async () => {
    const files = Array.from(input.files);
    if (!files.length) return;
    if (addFileButton) addFileButton.disabled = true;
    status.textContent = 'Bestanden opslaan...';
    let saved = 0;
    try {
      for (const file of files) {
        await transaction('readwrite', (store) => store.add({ subject, name: file.name, file, addedAt: Date.now() }));
        saved += 1;
      }
      status.textContent = `${saved} bestand(en) toegevoegd.`;
    } catch {
      status.textContent = `${saved} bestand(en) toegevoegd. De overige bestanden konden niet worden opgeslagen. Mogelijk is de browseropslag vol.`;
    } finally {
      input.value = '';
      if (addFileButton) addFileButton.disabled = false;
      try { await renderFiles(); } catch { status.textContent = 'De bestandenlijst kan niet worden geladen. Vernieuw de pagina.'; }
    }
  });
  window.addEventListener('focus', () => {
    renderFiles().catch(() => { searchStatus.textContent = 'Bestanden vernieuwen is niet gelukt. Vernieuw de pagina.'; });
  });
  initialize();
}