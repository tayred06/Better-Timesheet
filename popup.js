function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

const PROJECTS_KEY = "__projects__";
const NOTES_KEY = "__notes__";
const TODOS_KEY = "__todos__";
const UI_STATE_KEY = "__ui_state__";
const TIMESHEET_URL_KEY = "__timesheet_url__";
const THEME_KEY = "__theme__";

// State
let currentView = 'dashboard';
let selectedProject = null;
let currentTabHostname = null;

// --- Initialization ---

// Theme
const themeToggleBtn = document.getElementById("theme-toggle");
function applyTheme(theme) {
  document.body.dataset.theme = theme;
  themeToggleBtn.textContent = theme === "light" ? "☀️" : "🌙";
  chrome.storage.local.set({ [THEME_KEY]: theme });
}

chrome.storage.local.get(THEME_KEY, (result) => {
  applyTheme(result[THEME_KEY] || "dark");
});

if (themeToggleBtn) {
  themeToggleBtn.onclick = () => {
    const newTheme = document.body.dataset.theme === "light" ? "dark" : "light";
    applyTheme(newTheme);
  };
}

// Auto-refresh
setInterval(() => {
  updateTimes();
}, 10000);

// Initial Render
function updateCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url) {
      try {
        currentTabHostname = new URL(tabs[0].url).hostname;
      } catch (e) { }
    }
    render();
  });
}

updateCurrentTab();

// Listen for tab changes to update highlighting live
chrome.tabs.onActivated.addListener(() => {
  updateCurrentTab();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    updateCurrentTab();
  }
});

// --- Rendering Logic ---

function render() {
  chrome.storage.local.get(null, data => {
    if (currentView === 'dashboard') {
      renderDashboard(data);
    } else if (currentView === 'detail' && selectedProject) {
      renderProjectDetail(data, selectedProject);
    }
  });
}

function renderDashboard(data) {
  const container = document.getElementById("project-list");
  container.innerHTML = ""; // Clear

  const projects = data[PROJECTS_KEY] || {};
  const sites = { ...data };
  delete sites[PROJECTS_KEY];
  delete sites[NOTES_KEY];
  delete sites[UI_STATE_KEY];
  delete sites[TIMESHEET_URL_KEY];
  delete sites[THEME_KEY];

  // Render Projects
  Object.keys(projects).forEach(projName => {
    const projSites = projects[projName] || [];
    let totalTime = 0;
    projSites.forEach(site => totalTime += (sites[site] || 0));

    const card = createProjectCard(projName, totalTime);
    container.appendChild(card);
  });

  // Render Unassigned (Autres)
  const allAssignedSites = Object.values(projects).flat();
  const unassignedSites = Object.keys(sites).filter(site => !allAssignedSites.includes(site));

  if (unassignedSites.length > 0) {
    let totalTime = 0;
    unassignedSites.forEach(site => totalTime += (sites[site] || 0));
    const card = createProjectCard("Autres", totalTime, true);
    container.appendChild(card);
  }
}

function createProjectCard(name, time, isUnassigned = false) {
  const card = document.createElement("div");
  card.className = "project-card";
  card.onclick = () => navigateToProject(name);

  const title = document.createElement("span");
  title.className = "card-title";
  title.textContent = name;

  const timeSpan = document.createElement("span");
  timeSpan.className = "card-time";
  timeSpan.dataset.project = name; // For live updates
  timeSpan.textContent = formatTime(time);

  card.appendChild(title);
  card.appendChild(timeSpan);
  return card;
}

function renderProjectDetail(data, projectName) {
  const projects = data[PROJECTS_KEY] || {};
  const notes = data[NOTES_KEY] || {};
  const sites = { ...data };
  // cleanup sites object
  [PROJECTS_KEY, NOTES_KEY, UI_STATE_KEY, TIMESHEET_URL_KEY, THEME_KEY].forEach(k => delete sites[k]);

  let projSites = [];
  if (projectName === "Autres") {
    const allAssignedSites = Object.values(projects).flat();
    projSites = Object.keys(sites).filter(site => !allAssignedSites.includes(site));
  } else {
    projSites = projects[projectName] || [];
  }

  let totalTime = 0;
  const siteElements = [];
  projSites.forEach(site => {
    const sec = sites[site] || 0;
    totalTime += sec;
    siteElements.push(createSiteRow(site, sec, projectName === "Autres" ? null : projectName));
  });

  // Update Header
  document.getElementById("detail-title").textContent = projectName;
  const timeDisplay = document.getElementById("detail-time");
  timeDisplay.textContent = formatTime(totalTime);
  timeDisplay.dataset.project = projectName;

  // Content Container
  const content = document.getElementById("detail-content");
  content.innerHTML = "";

  // --- Sites Accordion ---
  const sitesAccordion = document.createElement("div");
  sitesAccordion.className = "accordion-section";

  // Check collapsed state
  const isSitesCollapsed = (data[UI_STATE_KEY] || {})[`${projectName}_sites_collapsed`] === true;
  if (isSitesCollapsed) sitesAccordion.classList.add("collapsed");

  // Header
  const sitesHeader = document.createElement("div");
  sitesHeader.className = "accordion-section-header";
  sitesHeader.onclick = () => {
    const collapsed = sitesAccordion.classList.toggle("collapsed");
    saveUiState(`${projectName}_sites_collapsed`, collapsed);
  };

  const sitesTitle = document.createElement("span");
  sitesTitle.className = "accordion-section-title";
  sitesTitle.textContent = `Sites (${projSites.length})`;

  const sitesIcon = document.createElement("span");
  sitesIcon.className = "accordion-section-icon";
  sitesIcon.textContent = "▼";

  sitesHeader.appendChild(sitesTitle);
  sitesHeader.appendChild(sitesIcon);

  // Body
  const sitesBody = document.createElement("div");
  sitesBody.className = "accordion-section-body";

  // Sites List
  const sitesList = document.createElement("div");
  sitesList.className = "sites-list";
  siteElements.forEach(el => sitesList.appendChild(el));

  // Add Site Input (only for real projects)
  if (projectName !== "Autres") {
    const inputRow = document.createElement("div");
    inputRow.className = "site-input-row";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Ajouter un site...";
    input.className = "new-site-input";
    input.onkeydown = (e) => {
      if (e.key === "Enter") addSite(input.value.trim(), projectName);
    };

    const addBtn = document.createElement("button");
    addBtn.textContent = "+";
    addBtn.className = "add-site-btn";
    addBtn.onclick = () => addSite(input.value.trim(), projectName);

    inputRow.appendChild(input);
    inputRow.appendChild(addBtn);
    sitesList.appendChild(inputRow);
  }

  sitesBody.appendChild(sitesList);
  sitesAccordion.appendChild(sitesHeader);
  sitesAccordion.appendChild(sitesBody);
  content.appendChild(sitesAccordion);

  // Notes & Actions (only for real projects)
  if (projectName !== "Autres") {
    // --- Todo List Accordion ---
    const todosAccordion = document.createElement("div");
    todosAccordion.className = "accordion-section";

    const isTodosCollapsed = (data[UI_STATE_KEY] || {})[`${projectName}_todos_collapsed`] === true;
    if (isTodosCollapsed) todosAccordion.classList.add("collapsed");

    // Header
    const todosHeader = document.createElement("div");
    todosHeader.className = "accordion-section-header";
    todosHeader.onclick = () => {
      const collapsed = todosAccordion.classList.toggle("collapsed");
      saveUiState(`${projectName}_todos_collapsed`, collapsed);
    };

    const projTodos = (data[TODOS_KEY] || {})[projectName] || [];
    const activeTodos = projTodos.filter(t => !t.done).length;

    const todosTitle = document.createElement("span");
    todosTitle.className = "accordion-section-title";
    todosTitle.textContent = `Tâches (${activeTodos}/${projTodos.length})`;

    const todosIcon = document.createElement("span");
    todosIcon.className = "accordion-section-icon";
    todosIcon.textContent = "▼";

    todosHeader.appendChild(todosTitle);
    todosHeader.appendChild(todosIcon);

    // Body
    const todosBody = document.createElement("div");
    todosBody.className = "accordion-section-body";

    const todoList = document.createElement("div");
    todoList.className = "todo-list";

    // Render Todos
    projTodos.forEach((todo, index) => {
      const item = document.createElement("div");
      item.className = "todo-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "todo-checkbox";
      checkbox.checked = todo.done;
      checkbox.onchange = () => toggleTodo(projectName, index, checkbox.checked);

      const text = document.createElement("span");
      text.className = "todo-text";
      if (todo.done) text.classList.add("done");
      text.textContent = todo.text;

      const delBtn = document.createElement("button");
      delBtn.className = "todo-delete-btn";
      delBtn.innerHTML = "✕";
      delBtn.onclick = () => deleteTodo(projectName, index);

      item.appendChild(checkbox);
      item.appendChild(text);
      item.appendChild(delBtn);
      todoList.appendChild(item);
    });

    // Add Todo Input
    const todoInputRow = document.createElement("div");
    todoInputRow.className = "site-input-row"; // Reuse style

    const todoInput = document.createElement("input");
    todoInput.type = "text";
    todoInput.placeholder = "Nouvelle tâche...";
    todoInput.className = "new-site-input";
    todoInput.onkeydown = (e) => {
      if (e.key === "Enter") addTodo(projectName, todoInput.value.trim());
    };

    const addTodoBtn = document.createElement("button");
    addTodoBtn.textContent = "+";
    addTodoBtn.className = "add-site-btn";
    addTodoBtn.onclick = () => addTodo(projectName, todoInput.value.trim());

    todoInputRow.appendChild(todoInput);
    todoInputRow.appendChild(addTodoBtn);
    todoList.appendChild(todoInputRow);

    todosBody.appendChild(todoList);
    todosAccordion.appendChild(todosHeader);
    todosAccordion.appendChild(todosBody);
    content.appendChild(todosAccordion);

    // --- Notes Accordion ---
    const notesAccordion = document.createElement("div");
    notesAccordion.className = "accordion-section";

    // Check collapsed state (Default open for notes usually, but let's support collapse)
    const isNotesCollapsed = (data[UI_STATE_KEY] || {})[`${projectName}_notes_collapsed`] === true;
    if (isNotesCollapsed) notesAccordion.classList.add("collapsed");

    // Header
    const notesHeader = document.createElement("div");
    notesHeader.className = "accordion-section-header";
    notesHeader.onclick = () => {
      const collapsed = notesAccordion.classList.toggle("collapsed");
      saveUiState(`${projectName}_notes_collapsed`, collapsed);
    };

    const notesTitle = document.createElement("span");
    notesTitle.className = "accordion-section-title";
    notesTitle.textContent = "Notes";

    const notesIcon = document.createElement("span");
    notesIcon.className = "accordion-section-icon";
    notesIcon.textContent = "▼";

    notesHeader.appendChild(notesTitle);
    notesHeader.appendChild(notesIcon);

    // Body
    const notesBody = document.createElement("div");
    notesBody.className = "accordion-section-body";

    const noteContainer = document.createElement("div");
    noteContainer.className = "project-note-container";

    const textarea = document.createElement("textarea");
    textarea.className = "project-note";
    textarea.placeholder = "Notes du projet...";
    textarea.value = notes[projectName] || "";
    textarea.onchange = () => saveNote(projectName, textarea.value);

    noteContainer.appendChild(textarea);
    notesBody.appendChild(noteContainer);

    notesAccordion.appendChild(notesHeader);
    notesAccordion.appendChild(notesBody);
    content.appendChild(notesAccordion);

    // Actions Row (Moved to Footer)
    const footer = document.getElementById("detail-footer");
    footer.innerHTML = ""; // Clear previous

    const actionsRow = document.createElement("div");
    actionsRow.style.display = "flex";
    actionsRow.style.gap = "8px";
    actionsRow.style.marginBottom = "8px"; // Spacing from bottom

    const resetBtn = document.createElement("button");
    resetBtn.className = "reset-project-btn";
    resetBtn.textContent = "Réinitialiser les temps";
    resetBtn.style.flex = "1";
    resetBtn.onclick = () => {
      if (confirm(`Réinitialiser tous les temps du projet "${projectName}" ?`)) {
        resetProjectTimers(projectName);
      }
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "reset-project-btn"; // Reuse style
    deleteBtn.style.backgroundColor = "transparent";
    deleteBtn.style.color = "var(--danger-color)";
    deleteBtn.style.border = "1px solid var(--danger-color)";
    deleteBtn.textContent = "Supprimer le projet";
    deleteBtn.onclick = () => {
      if (confirm(`Supprimer le projet ${projectName} ?`)) {
        deleteProject(projectName);
      }
    };

    actionsRow.appendChild(resetBtn);
    actionsRow.appendChild(deleteBtn);

    footer.appendChild(actionsRow);
  } else {
    // Clear footer for "Autres"
    document.getElementById("detail-footer").innerHTML = "";
  }
}

function createSiteRow(site, sec, projectName) {
  const row = document.createElement("div");
  row.className = "site";

  if (currentTabHostname && (site === currentTabHostname || site.includes(currentTabHostname) || currentTabHostname.includes(site))) {
    row.classList.add("active-tracking");
  }

  const info = document.createElement("div");
  info.className = "site-info";

  const nameSpan = document.createElement("span");
  nameSpan.className = "site-name";
  nameSpan.textContent = site;

  const timeSpan = document.createElement("span");
  timeSpan.className = "site-time";
  timeSpan.dataset.site = site;
  timeSpan.textContent = formatTime(sec);

  info.appendChild(nameSpan);
  info.appendChild(timeSpan);

  const actions = document.createElement("div");
  actions.className = "site-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "action-btn";
  editBtn.innerHTML = "✏️";
  editBtn.onclick = (e) => {
    e.stopPropagation();
    const newSite = prompt("Nouveau nom du site :", site);
    if (newSite && newSite !== site) {
      renameSite(site, newSite, projectName);
    }
  };

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "action-btn delete";
  deleteBtn.innerHTML = "🗑️";
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    if (confirm(`Supprimer ${site} ?`)) {
      deleteSite(site, projectName);
    }
  };

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  row.appendChild(info);
  row.appendChild(actions);
  return row;
}

function renameSite(oldSite, newSite, projectName) {
  chrome.storage.local.get([oldSite, newSite, PROJECTS_KEY], (result) => {
    if (result[newSite] !== undefined) {
      alert("Ce site existe déjà !");
      return;
    }

    const updates = {};
    updates[newSite] = result[oldSite];

    if (projectName) {
      const projects = result[PROJECTS_KEY] || {};
      if (projects[projectName]) {
        const index = projects[projectName].indexOf(oldSite);
        if (index > -1) {
          projects[projectName][index] = newSite;
          updates[PROJECTS_KEY] = projects;
        }
      }
    }

    chrome.storage.local.set(updates, () => {
      chrome.storage.local.remove(oldSite, () => render());
    });
  });
}

// --- Navigation ---

function navigateToProject(name) {
  selectedProject = name;
  currentView = 'detail';

  document.getElementById("dashboard-view").classList.remove("active");
  document.getElementById("detail-view").classList.add("active");

  // Hide global controls/footer if needed? 
  // For now keeping footer, but maybe hiding "Add Project" input which is in dashboard view anyway.

  render();
}

document.getElementById("back-btn").onclick = () => {
  currentView = 'dashboard';
  selectedProject = null;

  document.getElementById("detail-view").classList.remove("active");
  document.getElementById("dashboard-view").classList.add("active");

  render();
};

// --- Live Updates ---

function updateTimes() {
  chrome.storage.local.get(null, data => {
    const projects = data[PROJECTS_KEY] || {};
    const sites = { ...data };
    // cleanup
    [PROJECTS_KEY, NOTES_KEY, UI_STATE_KEY, TIMESHEET_URL_KEY, THEME_KEY].forEach(k => delete sites[k]);

    // Update Site Times (if visible)
    Object.keys(sites).forEach(site => {
      const el = document.querySelector(`.site-time[data-site="${site}"]`);
      if (el) el.textContent = formatTime(sites[site]);
    });

    // Update Project Times (Dashboard Cards & Detail Header)
    // 1. Real Projects
    Object.keys(projects).forEach(projName => {
      let total = 0;
      (projects[projName] || []).forEach(s => total += (sites[s] || 0));

      const els = document.querySelectorAll(`[data-project="${projName}"]`);
      els.forEach(el => el.textContent = formatTime(total));
    });

    // 2. Autres
    const allAssigned = Object.values(projects).flat();
    const unassigned = Object.keys(sites).filter(s => !allAssigned.includes(s));
    let totalAutres = 0;
    unassigned.forEach(s => totalAutres += (sites[s] || 0));

    const els = document.querySelectorAll(`[data-project="Autres"]`);
    els.forEach(el => el.textContent = formatTime(totalAutres));
  });
}

// --- Actions ---

function saveUiState(key, value) {
  chrome.storage.local.get(UI_STATE_KEY, (result) => {
    const state = result[UI_STATE_KEY] || {};
    state[key] = value;
    chrome.storage.local.set({ [UI_STATE_KEY]: state });
  });
}

function saveNote(projectName, content) {
  chrome.storage.local.get(NOTES_KEY, (result) => {
    const notes = result[NOTES_KEY] || {};
    notes[projectName] = content;
    chrome.storage.local.set({ [NOTES_KEY]: notes });
  });
}

function addSite(site, project) {
  if (!site) return;
  chrome.storage.local.get([site, PROJECTS_KEY], (result) => {
    const updates = {};
    if (result[site] === undefined) updates[site] = 0;

    if (project && project !== "Autres") {
      const projects = result[PROJECTS_KEY] || {};
      if (projects[project] && !projects[project].includes(site)) {
        projects[project].push(site);
        updates[PROJECTS_KEY] = projects;
      }
    }

    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates, () => render());
    } else {
      alert("Site déjà existant ou ajouté.");
    }
  });
}

function deleteSite(site, projectName) {
  chrome.storage.local.get([PROJECTS_KEY], (result) => {
    const projects = result[PROJECTS_KEY] || {};
    if (projectName && projects[projectName]) {
      projects[projectName] = projects[projectName].filter(s => s !== site);
    }
    chrome.storage.local.remove(site, () => {
      chrome.storage.local.set({ [PROJECTS_KEY]: projects }, () => render());
    });
  });
}

function deleteProject(projectName) {
  chrome.storage.local.get([PROJECTS_KEY, NOTES_KEY, TODOS_KEY], (result) => {
    const projects = result[PROJECTS_KEY] || {};
    const notes = result[NOTES_KEY] || {};
    const todos = result[TODOS_KEY] || {};

    delete projects[projectName];
    delete notes[projectName];
    delete todos[projectName];

    chrome.storage.local.set({
      [PROJECTS_KEY]: projects,
      [NOTES_KEY]: notes,
      [TODOS_KEY]: todos
    }, () => {
      // Go back to dashboard
      document.getElementById("back-btn").click();
    });
  });
}

function resetProjectTimers(projectName) {
  chrome.storage.local.get(PROJECTS_KEY, (result) => {
    const projects = result[PROJECTS_KEY] || {};
    const sites = projects[projectName] || [];
    if (sites.length === 0) return;

    const updates = {};
    sites.forEach(site => updates[site] = 0);
    chrome.storage.local.set(updates, () => render());
  });
}

function addTodo(projectName, text) {
  if (!text) return;
  chrome.storage.local.get(TODOS_KEY, (result) => {
    const todos = result[TODOS_KEY] || {};
    if (!todos[projectName]) todos[projectName] = [];

    todos[projectName].push({ text: text, done: false });

    chrome.storage.local.set({ [TODOS_KEY]: todos }, () => render());
  });
}

function toggleTodo(projectName, index, isDone) {
  chrome.storage.local.get(TODOS_KEY, (result) => {
    const todos = result[TODOS_KEY] || {};
    if (todos[projectName] && todos[projectName][index]) {
      todos[projectName][index].done = isDone;
      chrome.storage.local.set({ [TODOS_KEY]: todos }, () => render());
    }
  });
}

function deleteTodo(projectName, index) {
  chrome.storage.local.get(TODOS_KEY, (result) => {
    const todos = result[TODOS_KEY] || {};
    if (todos[projectName]) {
      todos[projectName].splice(index, 1);
      chrome.storage.local.set({ [TODOS_KEY]: todos }, () => render());
    }
  });
}

// Global Actions
document.getElementById("add-project").onclick = () => {
  const input = document.getElementById("new-project");
  const name = input.value.trim();
  if (!name) return;

  chrome.storage.local.get(PROJECTS_KEY, (result) => {
    const projects = result[PROJECTS_KEY] || {};
    if (projects[name]) {
      alert("Ce projet existe déjà !");
      return;
    }
    projects[name] = [];
    chrome.storage.local.set({ [PROJECTS_KEY]: projects }, () => {
      input.value = "";
      render();
    });
  });
};

document.getElementById("reset-all").onclick = () => {
  if (confirm("Réinitialiser TOUS les temps de TOUS les projets ?")) {
    chrome.storage.local.get(null, (data) => {
      const updates = {};
      Object.keys(data).forEach(key => {
        if (![PROJECTS_KEY, NOTES_KEY, UI_STATE_KEY, TIMESHEET_URL_KEY, THEME_KEY].includes(key)) {
          updates[key] = 0;
        }
      });
      chrome.storage.local.set(updates, () => render());
    });
  }
};

// Export/Import/Timesheet (Same as before)
document.getElementById("export").onclick = () => {
  chrome.storage.local.get(null, (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "better_timesheet_backup.json";
    a.click();
    URL.revokeObjectURL(url);
  });
};

document.getElementById("import").onclick = () => document.getElementById("import-file").click();
document.getElementById("import-file").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (confirm("Cela remplacera toutes vos données actuelles. Continuer ?")) {
        chrome.storage.local.clear(() => {
          chrome.storage.local.set(data, () => location.reload());
        });
      }
    } catch (error) {
      alert("Erreur lors de la lecture du fichier JSON.");
    }
  };
  reader.readAsText(file);
};

const timesheetBtn = document.getElementById("open-timesheet");
timesheetBtn.onclick = () => {
  chrome.storage.local.get(TIMESHEET_URL_KEY, (result) => {
    const url = result[TIMESHEET_URL_KEY];
    if (!url) {
      alert("Veuillez d'abord configurer l'URL (clic droit).");
      return;
    }
    chrome.tabs.create({ url: url });
  });
};
timesheetBtn.oncontextmenu = (e) => {
  e.preventDefault();
  chrome.storage.local.get(TIMESHEET_URL_KEY, (result) => {
    const newUrl = prompt("URL de la feuille de temps :", result[TIMESHEET_URL_KEY] || "");
    if (newUrl !== null) chrome.storage.local.set({ [TIMESHEET_URL_KEY]: newUrl.trim() }, () => alert("URL enregistrée !"));
  });
};
