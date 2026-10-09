"use strict";

(() => {
  const STORAGE_KEY = "deskflow-tickets-v1";
  const STATUSES = ["Open", "In Progress", "Resolved"];
  const PRIORITIES = ["Low", "Medium", "High"];
  const CATEGORIES = [
    "Hardware",
    "Software",
    "Network",
    "Account Access",
    "Other"
  ];

  const $ = (id) => document.getElementById(id);

  const form = $("ticket-form");
  const ticketDialog = $("ticket-dialog");
  const deleteDialog = $("delete-dialog");

  let tickets = [];
  let activeTicketId = null;
  let pendingDeleteId = null;
  let storageBlocked = false;
  let toastTimer;

  function showError(id, message = "") {
    const element = $(id);
    element.textContent = message;
    element.hidden = !message;
  }

  function notify(message, type = "success") {
    clearTimeout(toastTimer);

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = type === "error" ? "!" : "✓";

    const text = document.createElement("span");
    text.textContent = message;

    toast.append(icon, text);
    $("toast-container").replaceChildren(toast);

    toastTimer = setTimeout(() => {
      $("toast-container").replaceChildren();
    }, 4500);
  }

  function isValidTicket(ticket) {
    if (!ticket || typeof ticket !== "object") return false;

    const stringFields = [
      "id",
      "employeeName",
      "employeeEmail",
      "title",
      "description",
      "createdAt"
    ];

    return (
      stringFields.every(
        (key) =>
          typeof ticket[key] === "string" &&
          ticket[key].trim().length > 0
      ) &&
      STATUSES.includes(ticket.status) &&
      PRIORITIES.includes(ticket.priority) &&
      CATEGORIES.includes(ticket.category) &&
      Number.isFinite(Date.parse(ticket.createdAt))
    );
  }

  function loadTickets() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return [];

      const data = JSON.parse(raw);

      if (
        !Array.isArray(data) ||
        !data.every(isValidTicket) ||
        new Set(data.map((ticket) => ticket.id)).size !== data.length
      ) {
        throw new Error("Invalid saved data");
      }

      return data;
    } catch {
      storageBlocked = true;
      notify(
        "Saved tickets could not be read. Changes are paused to protect existing data.",
        "error"
      );
      return [];
    }
  }

  function saveTickets(nextTickets, errorId) {
    if (storageBlocked) {
      showError(
        errorId,
        "Storage is unavailable or saved data could not be read. Allow browser storage and reload. If saved data is damaged, back it up before clearing it."
      );
      return false;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTickets));
      tickets = nextTickets;
      showError(errorId);
      renderAll();
      return true;
    } catch {
      showError(
        errorId,
        "Could not save this change. Browser storage may be full or disabled. Your current tickets have not been changed."
      );
      return false;
    }
  }

  function formatDate(value, includeTime = false) {
    const options = {
      day: "2-digit",
      month: "short",
      year: "numeric"
    };

    if (includeTime) {
      options.hour = "2-digit";
      options.minute = "2-digit";
    }

    return new Intl.DateTimeFormat("en-IN", options).format(
      new Date(value)
    );
  }

  function sortedTickets() {
    return [...tickets].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
  }

  function makeBadge(value, kind) {
    const badge = document.createElement("span");
    const slug = value.toLowerCase().replace(/\s+/g, "-");
    badge.className = `badge ${kind}-badge ${kind}-${slug}`;
    badge.textContent = value;
    return badge;
  }

  function makeCell(text, className = "") {
    const cell = document.createElement("td");
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function makeAction(label, action, ticket) {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      action === "delete"
        ? "action-button delete-button"
        : "action-button";
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.id = ticket.id;
    button.setAttribute(
      "aria-label",
      `${label} ticket ${ticket.id}: ${ticket.title}`
    );
    return button;
  }

  function makeTicketRow(ticket, full = false) {
    const row = document.createElement("tr");

    const titleCell = document.createElement("td");
    const title = document.createElement("span");
    title.className = "ticket-title";
    title.textContent = ticket.title;

    const id = document.createElement("span");
    id.className = "ticket-id";
    id.textContent = ticket.id;

    titleCell.append(title, id);
    row.append(titleCell);

    if (full) {
      const employeeCell = document.createElement("td");
      const employee = document.createElement("span");
      employee.className = "employee-name";
      employee.textContent = ticket.employeeName;

      const email = document.createElement("span");
      email.className = "employee-email";
      email.textContent = ticket.employeeEmail;

      employeeCell.append(employee, email);
      row.append(employeeCell, makeCell(ticket.category));
    }

    const priorityCell = document.createElement("td");
    priorityCell.append(makeBadge(ticket.priority, "priority"));

    const statusCell = document.createElement("td");
    statusCell.append(makeBadge(ticket.status, "status"));

    const actionsCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "table-actions";
    actions.append(makeAction("View", "view", ticket));

    if (full) {
      actions.append(
        makeAction("Edit", "edit", ticket),
        makeAction("Delete", "delete", ticket)
      );
    }

    actionsCell.append(actions);

    row.append(
      priorityCell,
      statusCell,
      makeCell(formatDate(ticket.createdAt), "ticket-date"),
      actionsCell
    );

    return row;
  }

  function renderDashboard() {
    const total = tickets.length;
    const open = tickets.filter((t) => t.status === "Open").length;
    const progress = tickets.filter(
      (t) => t.status === "In Progress"
    ).length;
    const resolved = tickets.filter(
      (t) => t.status === "Resolved"
    ).length;
    const percent = total ? Math.round((resolved / total) * 100) : 0;

    $("total-count").textContent = total;
    $("open-count").textContent = open;
    $("progress-count").textContent = progress;
    $("resolved-count").textContent = resolved;
    $("sidebar-ticket-count").textContent = total;

    $("legend-open").textContent = open;
    $("legend-progress").textContent = progress;
    $("legend-resolved").textContent = resolved;

    $("resolution-percent").textContent = `${percent}%`;
    $("resolution-ring").style.setProperty(
      "--progress",
      `${percent}%`
    );

    $("resolution-summary").textContent = total
      ? `${resolved} of ${total} tickets resolved.`
      : "No tickets yet.";

    $("recent-ticket-body").replaceChildren(
      ...sortedTickets()
        .slice(0, 5)
        .map((ticket) => makeTicketRow(ticket))
    );

    $("dashboard-empty").hidden = total > 0;

    $("recent-ticket-body")
      .closest(".table-scroll")
      .hidden = total === 0;
  }

  function renderManageTickets() {
    const query = $("ticket-search").value.trim().toLowerCase();
    const status = $("status-filter").value;
    const priority = $("priority-filter").value;

    const filtered = sortedTickets().filter((ticket) => {
      const searchable = [
        ticket.id,
        ticket.title,
        ticket.employeeName,
        ticket.employeeEmail,
        ticket.category
      ]
        .join(" ")
        .toLowerCase();

      return (
        searchable.includes(query) &&
        (status === "All" || ticket.status === status) &&
        (priority === "All" || ticket.priority === priority)
      );
    });

    $("manage-ticket-body").replaceChildren(
      ...filtered.map((ticket) => makeTicketRow(ticket, true))
    );

    $("manage-empty").hidden = filtered.length > 0;
    $("manage-ticket-body")
      .closest(".table-scroll")
      .hidden = filtered.length === 0;

    $("manage-empty-title").textContent = tickets.length
      ? "No matching tickets."
      : "No tickets yet.";

    $("manage-empty-description").textContent = tickets.length
      ? "Try a different search or reset your filters."
      : "Create a ticket to start organising support requests.";

    $("ticket-results-count").textContent =
      `Showing ${filtered.length} of ${tickets.length} tickets`;
  }

  function renderAll() {
    renderDashboard();
    renderManageTickets();
  }

  function setSidebar(open) {
    $("sidebar").classList.toggle("open", open);
    document.body.classList.toggle("sidebar-open", open);
    $("sidebar-overlay").hidden = !open;
    $("menu-toggle").setAttribute("aria-expanded", String(open));
    $("menu-toggle").setAttribute(
      "aria-label",
      open ? "Close navigation" : "Open navigation"
    );
  }

  function renderPage() {
    const names = {
      dashboard: "Dashboard",
      "create-ticket": "Create Ticket",
      "manage-tickets": "Manage Tickets"
    };

    let page = location.hash.slice(1) || "dashboard";

    if (!Object.hasOwn(names, page)) {
      page = "dashboard";
      history.replaceState(null, "", "#dashboard");
    }

    Object.keys(names).forEach((key) => {
      const section = $(`${key}-page`);
      section.hidden = key !== page;
      section.classList.toggle("active", key === page);
    });

    document.querySelectorAll(".nav-link").forEach((link) => {
      const active = link.dataset.page === page;
      link.classList.toggle("active", active);

      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    $("breadcrumb-page").textContent =
      page === "create-ticket" && $("editing-ticket-id").value
        ? "Edit Ticket"
        : names[page];

    setSidebar(false);
  }

  function resetForm() {
    form.reset();
    $("editing-ticket-id").value = "";
    $("description-counter").textContent = "0 / 2000";
    $("create-title").textContent = "Create a support ticket.";
    $("form-title").textContent = "Ticket information";
    $("submit-ticket-button").textContent = "Create Ticket →";
    $("reset-form-button").textContent = "Clear form";
    showError("form-error");
    renderPage();
  }

  function findTicket(id) {
    return tickets.find((ticket) => ticket.id === id);
  }

  function openTicket(id) {
    const ticket = findTicket(id);
    if (!ticket) {
      notify("This ticket is no longer available.", "error");
      return;
    }

    activeTicketId = id;
    $("detail-ticket-id").textContent = ticket.id;
    $("detail-title").textContent = ticket.title;
    $("detail-employee").textContent = ticket.employeeName;
    $("detail-email").textContent = ticket.employeeEmail;
    $("detail-category").textContent = ticket.category;
    $("detail-created").textContent = formatDate(
      ticket.createdAt,
      true
    );
    $("detail-description").textContent = ticket.description;
    $("detail-status").value = ticket.status;

    $("detail-badges").replaceChildren(
      makeBadge(ticket.priority, "priority"),
      makeBadge(ticket.status, "status")
    );

    showError("detail-error");
    ticketDialog.showModal();
  }

  function editTicket(id) {
    const ticket = findTicket(id);
    if (!ticket) {
      notify("This ticket is no longer available.", "error");
      return;
    }

    if (ticketDialog.open) ticketDialog.close();

    resetForm();

    $("editing-ticket-id").value = ticket.id;
    $("employee-name").value = ticket.employeeName;
    $("employee-email").value = ticket.employeeEmail;
    $("ticket-title").value = ticket.title;
    $("ticket-category").value = ticket.category;
    $("ticket-priority").value = ticket.priority;
    $("ticket-description").value = ticket.description;

    $("description-counter").textContent =
      `${ticket.description.length} / 2000`;

    $("create-title").textContent = "Edit your support ticket.";
    $("form-title").textContent = "Update ticket information";
    $("submit-ticket-button").textContent = "Save Changes →";
    $("reset-form-button").textContent = "Cancel edit";

    location.hash = "create-ticket";
    renderPage();
    $("employee-name").focus();
  }

  function requestDelete(id) {
    if (!findTicket(id)) {
      notify("This ticket is no longer available.", "error");
      return;
    }

    pendingDeleteId = id;
    showError("delete-error");
    deleteDialog.showModal();
  }

  function generateId() {
    let id;

    do {
      const suffix =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID().slice(0, 8)
          : Math.random().toString(36).slice(2, 10);

      id = `DF-${Date.now().toString(36)}-${suffix}`.toUpperCase();
    } while (findTicket(id));

    return id;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    showError("form-error");

    const values = {
      employeeName: $("employee-name").value.trim(),
      employeeEmail: $("employee-email").value.trim(),
      title: $("ticket-title").value.trim(),
      category: $("ticket-category").value,
      priority: $("ticket-priority").value,
      description: $("ticket-description").value.trim()
    };

    if (
      !values.employeeName ||
      !values.employeeEmail ||
      !values.title ||
      !values.description
    ) {
      showError(
        "form-error",
        "Please complete every required field. Spaces alone are not valid."
      );
      return;
    }

    if (
      !CATEGORIES.includes(values.category) ||
      !PRIORITIES.includes(values.priority) ||
      !$("employee-email").checkValidity()
    ) {
      showError(
        "form-error",
        "Enter a valid email and select a category and priority."
      );
      return;
    }

    const editingId = $("editing-ticket-id").value;
    let nextTickets;

    if (editingId) {
      const existing = findTicket(editingId);

      if (!existing) {
        showError(
          "form-error",
          "This ticket no longer exists. Cancel editing and create a new ticket."
        );
        return;
      }

      nextTickets = tickets.map((ticket) =>
        ticket.id === editingId
          ? {
              ...ticket,
              ...values,
              updatedAt: new Date().toISOString()
            }
          : ticket
      );
    } else {
      const now = new Date().toISOString();

      nextTickets = [
        ...tickets,
        {
          id: generateId(),
          ...values,
          status: "Open",
          createdAt: now,
          updatedAt: now
        }
      ];
    }

    if (!saveTickets(nextTickets, "form-error")) return;

    resetForm();
    $("ticket-search").value = "";
    $("status-filter").value = "All";
    $("priority-filter").value = "All";
    renderManageTickets();

    location.hash = "manage-tickets";
    renderPage();

    notify(
      editingId
        ? "Ticket updated successfully."
        : "Ticket created successfully."
    );
  });

  $("reset-form-button").addEventListener("click", () => {
    const wasEditing = Boolean($("editing-ticket-id").value);
    resetForm();

    if (wasEditing) {
      location.hash = "manage-tickets";
      renderPage();
    }
  });

  $("ticket-description").addEventListener("input", () => {
    $("description-counter").textContent =
      `${$("ticket-description").value.length} / 2000`;
  });

  function handleTableAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const { action, id } = button.dataset;

    if (action === "view") openTicket(id);
    if (action === "edit") editTicket(id);
    if (action === "delete") requestDelete(id);
  }

  $("recent-ticket-body").addEventListener(
    "click",
    handleTableAction
  );

  $("manage-ticket-body").addEventListener(
    "click",
    handleTableAction
  );

  $("ticket-search").addEventListener(
    "input",
    renderManageTickets
  );

  $("status-filter").addEventListener(
    "change",
    renderManageTickets
  );

  $("priority-filter").addEventListener(
    "change",
    renderManageTickets
  );

  $("clear-filters").addEventListener("click", () => {
    $("ticket-search").value = "";
    $("status-filter").value = "All";
    $("priority-filter").value = "All";
    renderManageTickets();
  });

  $("close-ticket-dialog").addEventListener("click", () => {
    ticketDialog.close();
  });

  $("edit-detail-ticket").addEventListener("click", () => {
    editTicket(activeTicketId);
  });

  $("save-ticket-status").addEventListener("click", () => {
    const ticket = findTicket(activeTicketId);
    const status = $("detail-status").value;

    if (!ticket) {
      showError("detail-error", "This ticket no longer exists.");
      return;
    }

    if (!STATUSES.includes(status)) {
      showError("detail-error", "Select a valid status.");
      return;
    }

    const nextTickets = tickets.map((item) =>
      item.id === activeTicketId
        ? {
            ...item,
            status,
            updatedAt: new Date().toISOString()
          }
        : item
    );

    if (!saveTickets(nextTickets, "detail-error")) return;

    ticketDialog.close();
    notify("Ticket status updated successfully.");
  });

  $("cancel-delete").addEventListener("click", () => {
    deleteDialog.close();
  });

  $("confirm-delete").addEventListener("click", () => {
    if (!findTicket(pendingDeleteId)) {
      showError("delete-error", "This ticket no longer exists.");
      return;
    }

    const deletedId = pendingDeleteId;
    const nextTickets = tickets.filter(
      (ticket) => ticket.id !== deletedId
    );

    if (!saveTickets(nextTickets, "delete-error")) return;

    if ($("editing-ticket-id").value === deletedId) {
      resetForm();
    }

    deleteDialog.close();
    notify("Ticket deleted successfully.");
  });

  ticketDialog.addEventListener("close", () => {
    activeTicketId = null;
  });

  deleteDialog.addEventListener("close", () => {
    pendingDeleteId = null;
  });

  $("menu-toggle").addEventListener("click", () => {
    const open =
      $("menu-toggle").getAttribute("aria-expanded") === "true";
    setSidebar(!open);
  });

  $("sidebar-overlay").addEventListener("click", () => {
    setSidebar(false);
    $("menu-toggle").focus();
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      document.body.classList.contains("sidebar-open")
    ) {
      setSidebar(false);
      $("menu-toggle").focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) setSidebar(false);
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href="#create-ticket"]');
    if (!link) return;

    resetForm();
  });

  window.addEventListener("hashchange", renderPage);

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;

    storageBlocked = false;
    tickets = loadTickets();

    if (ticketDialog.open) ticketDialog.close();
    if (deleteDialog.open) deleteDialog.close();

    renderAll();
  });

  tickets = loadTickets();
  renderAll();
  renderPage();
})();