const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.nav');
menuButton.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
});
document.querySelectorAll('.nav a').forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
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

  const viewer = document.createElement('dialog');
  viewer.className = 'file-viewer';
  viewer.setAttribute('aria-labelledby', 'preview-title');
  viewer.innerHTML = '<div class="preview-header"><h2 id="preview-title"></h2><button type="button" autofocus>Sluiten</button></div><div class="preview-body"></div><p class="preview-footer">Geen voorbeeld zichtbaar? <a>Download het bestand</a></p>';
  document.body.append(viewer);
  const previewBody = viewer.querySelector('.preview-body');
  let previewUrl;
  let previewVersion = 0;
  viewer.querySelector('button').addEventListener('click', () => viewer.close());
  viewer.addEventListener('close', () => {
    previewVersion += 1;
    previewBody.replaceChildren();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  });

  async function openFile(record) {
    const version = ++previewVersion;
    previewBody.replaceChildren();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const extension = record.name.split('.').pop().toLowerCase();
    const type = record.file.type;
    const isPdf = type === 'application/pdf' || extension === 'pdf';
    previewUrl = record.url || URL.createObjectURL(isPdf ? record.file.slice(0, record.file.size, 'application/pdf') : record.file);
    viewer.querySelector('h2').textContent = record.name;
    const download = viewer.querySelector('a');
    download.href = previewUrl;
    download.download = record.name;
    viewer.showModal();
    // Update only an existing record so a deleted file cannot be restored accidentally.
    if (record.url) {
      record.lastOpenedAt = Date.now();
      renderFiles();
    } else transaction('readwrite', (store) => {
      const request = store.get(record.id);
      request.onsuccess = () => {
        if (request.result) store.put({ ...request.result, lastOpenedAt: Date.now() });
      };
      return request;
    }).then(() => renderFiles()).catch(() => {
      status.textContent = 'Het bestand is geopend, maar de recent-geopendlijst kon niet worden bijgewerkt.';
    });
    let element;
    if (type.startsWith('image/') || /^(png|jpe?g|gif|webp|avif|bmp|svg)$/.test(extension)) {
      element = document.createElement('img');
      element.alt = record.name;
      element.src = previewUrl;
    } else if (isPdf) {
      element = document.createElement('iframe');
      element.title = `Voorbeeld van ${record.name}`;
      element.src = previewUrl;
    } else if (type.startsWith('video/') || /^(mp4|webm|mov)$/.test(extension)) {
      element = document.createElement('video');
      element.controls = true;
      element.src = previewUrl;
    } else if (type.startsWith('audio/') || /^(mp3|wav|ogg|m4a|flac)$/.test(extension)) {
      element = document.createElement('audio');
      element.controls = true;
      element.src = previewUrl;
    } else if (type.startsWith('text/') || /^(txt|md|csv|json)$/.test(extension)) {
      element = document.createElement('pre');
      element.textContent = 'Tekst laden...';
      previewBody.append(element);
      try {
        const text = await record.file.slice(0, 1024 * 1024).text();
        if (version !== previewVersion) return;
        element.textContent = text + (record.file.size > 1024 * 1024 ? '\n\nVoorbeeld ingekort. Download het bestand voor de volledige tekst.' : '');
      } catch {
        if (version === previewVersion) element.textContent = 'Deze tekst kon niet worden geladen. Je kunt het bestand downloaden.';
      }
      return;
    } else {
      element = document.createElement('p');
      element.textContent = 'Voor dit bestandstype is geen voorbeeld beschikbaar. Je kunt het bestand downloaden. Sla Word- of PowerPoint-bestanden op als pdf om ze hier te bekijken.';
    }
    element.addEventListener('error', () => {
      const message = document.createElement('p');
      message.textContent = 'Dit bestand kan niet worden weergegeven in deze browser. Gebruik de downloadlink hieronder.';
      element.replaceWith(message);
    });
    previewBody.append(element);
  }
  const searchInput = document.querySelector('#file-search');
  const searchStatus = document.querySelector('#search-status');
  const searchResults = document.querySelector('#search-results');
  let searchRecords = [];
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
      const pages = { Dans: 'dans.html', Film: 'film.html', Muziek: 'muziek.html', Schilderkunst: 'schilderkunst.html' };
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
    searchRecords = records;
    searchFiles();
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
      cover.className = 'work-cover';
      if (record.file.type.startsWith('image/')) {
        const image = document.createElement('img');
        image.src = url;
        image.alt = record.name;
        image.loading = 'lazy';
        cover.append(image);
      } else {
        const format = document.createElement('span');
        format.textContent = record.name.split('.').pop().toUpperCase();
        const caption = document.createElement('strong');
        caption.textContent = record.name.replace(/\.[^.]+$/, '');
        cover.append(format, caption);
      }
      const hint = document.createElement('p');
      hint.className = 'work-hint';
      hint.textContent = 'Dubbelklik om te bekijken';
      row.append(cover, details, actions, hint);
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