function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

const PROJECTS_KEY = "__projects__";

const NOTES_KEY = "__notes__";

const UI_STATE_KEY = "__ui_state__";

// Auto-refresh display every 10 seconds
setInterval(() => {
  location.reload();
}, 10000);

chrome.storage.local.get(null, data => {
  const container = document.getElementById("result");
  const projectSelect = document.getElementById("project-select");

  // Extract projects, sites, notes, and UI state
  const projects = data[PROJECTS_KEY] || {};
  const notes = data[NOTES_KEY] || {};
  const uiState = data[UI_STATE_KEY] || {};
  const sites = { ...data };
  delete sites[PROJECTS_KEY];
  delete sites[NOTES_KEY];
  delete sites[UI_STATE_KEY];

  // Helper to get sites for a project
  const getProjectSites = (projName) => {
    return projects[projName] || [];
  };

  // Identify unassigned sites
  const allAssignedSites = Object.values(projects).flat();
  const unassignedSites = Object.keys(sites).filter(site => !allAssignedSites.includes(site));

  // Render Projects
  Object.keys(projects).forEach(projName => {
    const projSites = getProjectSites(projName);
    let totalTime = 0;
    const siteElements = [];

    projSites.forEach(site => {
      const sec = sites[site] || 0;
      totalTime += sec;
      siteElements.push(createSiteRow(site, sec, projName));
    });

    const projectNote = notes[projName] || "";
    const isOpen = uiState[`${projName}_open`] !== false; // Default open
    const sitesCollapsed = uiState[`${projName}_sites_collapsed`] === true; // Default expanded

    const accordion = createAccordion(projName, totalTime, siteElements, true, projectNote, isOpen, sitesCollapsed);
    container.appendChild(accordion);

    // Add to select (removed select, but keeping logic clean)
    // const option = document.createElement("option"); // Removed as per instructions
    // option.value = projName; // Removed as per instructions
    // option.textContent = projName; // Removed as per instructions
    // projectSelect.appendChild(option); // Removed as per instructions
  });

  // Render Unassigned
  if (unassignedSites.length > 0) {
    let totalTime = 0;
    const siteElements = [];
    unassignedSites.forEach(site => {
      const sec = sites[site] || 0;
      totalTime += sec;
      siteElements.push(createSiteRow(site, sec, null));
    });

    const accordion = createAccordion("Autres", totalTime, siteElements, false, "");
    container.appendChild(accordion);
  }
});

function createSiteRow(site, sec, projectName) {
  const row = document.createElement("div");
  row.className = "site";

  const info = document.createElement("div");
  info.className = "site-info";

  const nameSpan = document.createElement("span");
  nameSpan.className = "site-name";
  nameSpan.textContent = site;

  // Rename on click if in edit mode
  nameSpan.onclick = (e) => {
    if (row.closest('.project-accordion.edit-mode')) {
      e.stopPropagation();
      const newSite = prompt("Nouveau nom du site :", site);
      if (newSite && newSite !== site) {
        renameSite(site, newSite, projectName);
      }
    }
  };

  const timeSpan = document.createElement("span");
  timeSpan.className = "site-time";
  timeSpan.textContent = formatTime(sec);

  info.appendChild(nameSpan);
  info.appendChild(timeSpan);

  const actions = document.createElement("div");
  actions.className = "site-actions";

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "action-btn delete";
  deleteBtn.innerHTML = "🗑️";
  deleteBtn.title = "Supprimer le site";
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    if (confirm(`Supprimer ${site} ?`)) {
      deleteSite(site, projectName);
    }
  };

  actions.appendChild(deleteBtn);

  row.appendChild(info);
  row.appendChild(actions);
  return row;
}

function createAccordion(title, totalTime, children, isProject, noteContent, isOpen, sitesCollapsed) {
  const wrapper = document.createElement("div");
  wrapper.className = "project-accordion";

  const header = document.createElement("div");
  header.className = "accordion-header";

  const info = document.createElement("div");
  info.className = "project-info";

  const titleSpan = document.createElement("span");
  titleSpan.className = "project-name-text";
  titleSpan.textContent = title;

  // Rename project on click if in edit mode
  titleSpan.onclick = (e) => {
    if (wrapper.classList.contains('edit-mode')) {
      e.stopPropagation();
      const newName = prompt("Nouveau nom du projet :", title);
      if (newName && newName !== title) {
        renameProject(title, newName);
      }
    }
  };

  const timeSpan = document.createElement("span");
  timeSpan.textContent = formatTime(totalTime);

  info.appendChild(titleSpan);
  info.appendChild(timeSpan);

  const actions = document.createElement("div");
  actions.className = "project-actions";

  if (isProject) {
    // Edit Toggle Button
    const editBtn = document.createElement("button");
    editBtn.className = "action-btn edit-toggle";
    editBtn.innerHTML = "✏️"; // Pencil
    editBtn.title = "Mode édition";

    editBtn.onclick = (e) => {
      e.stopPropagation();
      wrapper.classList.toggle("edit-mode");
      const isEditing = wrapper.classList.contains("edit-mode");

      if (isEditing) {
        editBtn.classList.add("active");
        editBtn.innerHTML = "✓"; // Checkmark
        editBtn.title = "Terminer l'édition";
        // Ensure accordion is open when editing
        body.classList.add("open");
        saveUiState(`${title}_open`, true);
      } else {
        editBtn.classList.remove("active");
        editBtn.innerHTML = "✏️";
        editBtn.title = "Mode édition";
      }
    };
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "action-btn delete";
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.title = "Supprimer le projet";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Supprimer le projet ${title} ? Les sites ne seront pas supprimés.`)) {
        deleteProject(title);
      }
    };

    actions.appendChild(deleteBtn);
  }

  header.appendChild(info);
  header.appendChild(actions);

  const body = document.createElement("div");
  body.className = "accordion-body";
  if (isOpen) body.classList.add("open");

  // Sites Header & List
  const sitesHeader = document.createElement("div");
  sitesHeader.className = "sites-header";
  if (sitesCollapsed) sitesHeader.classList.add("collapsed");

  sitesHeader.innerHTML = `<span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary);">Sites (${children.length})</span><span class="sites-toggle-icon" style="font-size: 0.75rem; color: var(--text-secondary);">▼</span>`;

  const sitesList = document.createElement("div");
  sitesList.className = "sites-list";
  if (sitesCollapsed) sitesList.classList.add("collapsed");

  children.forEach(child => sitesList.appendChild(child));

  // Add Site Input Row (moved inside sites list)
  const inputRow = document.createElement("div");
  inputRow.className = "site-input-row";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Ajouter un site...";
  input.className = "new-site-input";

  // Allow pressing Enter to add
  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      addSite(input.value.trim(), isProject ? title : null);
    }
  };

  const addBtn = document.createElement("button");
  addBtn.textContent = "+";
  addBtn.className = "add-site-btn";
  addBtn.onclick = () => {
    addSite(input.value.trim(), isProject ? title : null);
  };

  inputRow.appendChild(input);
  inputRow.appendChild(addBtn);
  sitesList.appendChild(inputRow);

  sitesHeader.onclick = (e) => {
    e.stopPropagation();
    const isCollapsed = sitesList.classList.toggle("collapsed");
    sitesHeader.classList.toggle("collapsed");
    saveUiState(`${title}_sites_collapsed`, isCollapsed);
  };

  body.appendChild(sitesHeader);
  body.appendChild(sitesList);

  // Add Note Area if it's a project
  if (isProject) {
    const noteContainer = document.createElement("div");
    noteContainer.className = "project-note-container";

    const textarea = document.createElement("textarea");
    textarea.className = "project-note";
    textarea.placeholder = "Notes du projet...";
    textarea.value = noteContent;

    // Save note on change
    textarea.onchange = () => {
      saveNote(title, textarea.value);
    };

    noteContainer.appendChild(textarea);

    // Add Reset Project Timer Button
    const resetBtn = document.createElement("button");
    resetBtn.className = "reset-project-btn";
    resetBtn.textContent = "Réinitialiser les temps du projet";
    resetBtn.onclick = () => {
      if (confirm(`Réinitialiser tous les temps du projet "${title}" ?`)) {
        resetProjectTimers(title);
      }
    };

    noteContainer.appendChild(resetBtn);
    body.appendChild(noteContainer);
  }

  header.onclick = (e) => {
    // Don't toggle if clicking actions
    if (e.target.closest('.action-btn')) return;
    const isOpenNow = body.classList.toggle("open");
    saveUiState(`${title}_open`, isOpenNow);
  };

  wrapper.appendChild(header);
  wrapper.appendChild(body);
  return wrapper;
}

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

    // Init site time if needed
    if (result[site] === undefined) {
      updates[site] = 0;
    }

    // Add to project if selected
    if (project) {
      const projects = result[PROJECTS_KEY] || {};
      if (projects[project] && !projects[project].includes(site)) {
        projects[project].push(site);
        updates[PROJECTS_KEY] = projects;
      }
    }

    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates, () => {
        location.reload();
      });
    } else {
      alert("Site déjà existant ou ajouté.");
    }
  });
}

function deleteSite(site, projectName) {
  chrome.storage.local.get([PROJECTS_KEY], (result) => {
    const projects = result[PROJECTS_KEY] || {};

    // Remove from project if assigned
    if (projectName && projects[projectName]) {
      projects[projectName] = projects[projectName].filter(s => s !== site);
    }

    // Remove site data and update project
    chrome.storage.local.remove(site, () => {
      chrome.storage.local.set({ [PROJECTS_KEY]: projects }, () => {
        location.reload();
      });
    });
  });
}

function deleteProject(projectName) {
  chrome.storage.local.get(PROJECTS_KEY, (result) => {
    const projects = result[PROJECTS_KEY] || {};
    delete projects[projectName];
    chrome.storage.local.set({ [PROJECTS_KEY]: projects }, () => {
      location.reload();
    });
  });
}

function renameProject(oldName, newName) {
  chrome.storage.local.get(PROJECTS_KEY, (result) => {
    const projects = result[PROJECTS_KEY] || {};
    if (projects[newName]) {
      alert("Un projet avec ce nom existe déjà !");
      return;
    }
    projects[newName] = projects[oldName];
    delete projects[oldName];
    chrome.storage.local.set({ [PROJECTS_KEY]: projects }, () => {
      location.reload();
    });
  });
}

function renameSite(oldSite, newSite, projectName) {
  chrome.storage.local.get([oldSite, newSite, PROJECTS_KEY], (result) => {
    if (result[newSite] !== undefined) {
      alert("Ce site existe déjà !");
      return;
    }

    const updates = {};

    // Move time data
    updates[newSite] = result[oldSite];

    // Update project if assigned
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

    // Save new data
    chrome.storage.local.set(updates, () => {
      // Remove old data
      chrome.storage.local.remove(oldSite, () => {
        location.reload();
      });
    });
  });
}

// Bouton Export
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

// Bouton Import
document.getElementById("import").onclick = () => {
  document.getElementById("import-file").click();
};

document.getElementById("import-file").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (confirm("Cela remplacera toutes vos données actuelles. Continuer ?")) {
        chrome.storage.local.clear(() => {
          chrome.storage.local.set(data, () => {
            location.reload();
          });
        });
      }
    } catch (error) {
      alert("Erreur lors de la lecture du fichier JSON.");
    }
  };
  reader.readAsText(file);
};



// Bouton Créer Projet
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
      location.reload();
    });
  });
};

// Reset Project Timers
function resetProjectTimers(projectName) {
  chrome.storage.local.get(PROJECTS_KEY, (result) => {
    const projects = result[PROJECTS_KEY] || {};
    const sites = projects[projectName] || [];

    if (sites.length === 0) {
      location.reload();
      return;
    }

    // Reset all site timers in this project
    const updates = {};
    sites.forEach(site => {
      updates[site] = 0;
    });

    chrome.storage.local.set(updates, () => {
      location.reload();
    });
  });
}

// Reset All Timers
document.getElementById("reset-all").onclick = () => {
  if (confirm("Réinitialiser TOUS les temps de TOUS les projets ?")) {
    chrome.storage.local.get(null, (data) => {
      const updates = {};

      // Reset all site timers
      Object.keys(data).forEach(key => {
        if (key !== PROJECTS_KEY && key !== NOTES_KEY && key !== UI_STATE_KEY) {
          updates[key] = 0;
        }
      });

      chrome.storage.local.set(updates, () => {
        location.reload();
      });
    });
  }
};

const TIMESHEET_URL_KEY = "__timesheet_url__";

// Open Timesheet Button
const timesheetBtn = document.getElementById("open-timesheet");

timesheetBtn.onclick = () => {
  chrome.storage.local.get(TIMESHEET_URL_KEY, (result) => {
    const url = result[TIMESHEET_URL_KEY] || "";

    if (!url) {
      alert("Veuillez d'abord configurer l'URL de la feuille de temps (clic droit sur le bouton).");
      return;
    }

    chrome.tabs.create({ url: url });
  });
};

// Right-click to edit URL
timesheetBtn.oncontextmenu = (e) => {
  e.preventDefault();

  chrome.storage.local.get(TIMESHEET_URL_KEY, (result) => {
    const currentUrl = result[TIMESHEET_URL_KEY] || "";
    const newUrl = prompt("URL de la feuille de temps :", currentUrl);

    if (newUrl !== null && newUrl.trim() !== "") {
      chrome.storage.local.set({ [TIMESHEET_URL_KEY]: newUrl.trim() }, () => {
        alert("URL enregistrée !");
      });
    }
  });
};

// Removed old add-site listener as it is now handled inside accordions
