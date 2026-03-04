"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";

const VIEW_OPTIONS = ["kanban", "timeline", "list", "calendar"];
const STATUS_COLUMNS = [
  { key: "TODO", label: "To Do" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "DONE", label: "Done" },
];

export function BoardApp({ user }) {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [tags, setTags] = useState([]);
  const [view, setView] = useState("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  const [newProjectName, setNewProjectName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");

  const [taskForm, setTaskForm] = useState(defaultTaskForm());
  const [editingTaskId, setEditingTaskId] = useState("");
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    loadTasks(selectedProjectId);
    loadMembers(selectedProjectId);
    loadTags(selectedProjectId);
  }, [selectedProjectId]);

  async function loadProjects() {
    const res = await fetch("/api/projects", { cache: "no-store" });
    if (!res.ok) {
      setError("Failed to load projects");
      return;
    }

    const data = await res.json();
    setProjects(data.projects || []);

    if (!selectedProjectId && data.projects?.length) {
      setSelectedProjectId(data.projects[0].id);
    }
  }

  async function loadTasks(projectId) {
    const res = await fetch(`/api/projects/${projectId}/tasks`, { cache: "no-store" });
    if (!res.ok) {
      setError("Failed to load tasks");
      return;
    }

    const data = await res.json();
    setTasks(data.tasks || []);
  }

  async function loadMembers(projectId) {
    const res = await fetch(`/api/projects/${projectId}/members`, { cache: "no-store" });
    if (!res.ok) {
      setError("Failed to load members");
      return;
    }

    const data = await res.json();
    setMembers(data.members || []);
  }

  async function loadTags(projectId) {
    const res = await fetch(`/api/projects/${projectId}/tags`, { cache: "no-store" });
    if (!res.ok) {
      setError("Failed to load tags");
      return;
    }

    const data = await res.json();
    setTags(data.tags || []);
  }

  async function createProject(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const name = newProjectName.trim();
    if (!name) return;

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      setError("Failed to create project");
      return;
    }

    setNewProjectName("");
    await loadProjects();
    setMessage("Project created");
  }

  async function addMember(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const email = newMemberEmail.trim();
    if (!email || !selectedProjectId) return;

    const res = await fetch(`/api/projects/${selectedProjectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error || "Failed to add member");
      return;
    }

    setNewMemberEmail("");
    await loadMembers(selectedProjectId);
    setMessage("Member added");
  }

  async function createTag(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!selectedProjectId) return;

    const res = await fetch(`/api/projects/${selectedProjectId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to create tag");
      return;
    }

    setNewTagName("");
    await loadTags(selectedProjectId);
    setMessage("Tag created");
  }

  function startCreateTask() {
    setEditingTaskId("");
    setTaskForm(defaultTaskForm());
    setIsTaskModalOpen(true);
  }

  function startEditTask(task) {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title || "",
      description: task.description || "",
      status: task.status || "TODO",
      priority: task.priority || "MEDIUM",
      assigneeId: task.assigneeId || "",
      startDate: task.startDate ? String(task.startDate).slice(0, 10) : "",
      endDate: task.endDate ? String(task.endDate).slice(0, 10) : "",
      tagIds: (task.tags || []).map((item) => item.tagId),
    });
    setIsTaskModalOpen(true);
  }

  function closeTaskModal() {
    setIsTaskModalOpen(false);
    setEditingTaskId("");
    setTaskForm(defaultTaskForm());
  }

  async function saveTask(event) {
    event.preventDefault();
    if (!selectedProjectId) return;

    setError("");
    setMessage("");

    const payload = {
      ...taskForm,
      assigneeId: taskForm.assigneeId || null,
      startDate: taskForm.startDate || null,
      endDate: taskForm.endDate || null,
    };

    const endpoint = editingTaskId
      ? `/api/tasks/${editingTaskId}`
      : `/api/projects/${selectedProjectId}/tasks`;

    const method = editingTaskId ? "PATCH" : "POST";

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error || "Failed to save task");
      return;
    }

    const wasEditing = Boolean(editingTaskId);
    closeTaskModal();
    await loadTasks(selectedProjectId);
    setMessage(wasEditing ? "Task updated" : "Task created");
  }

  async function deleteTask(taskId) {
    setError("");
    setMessage("");

    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete task");
      return;
    }

    await loadTasks(selectedProjectId);
    if (editingTaskId === taskId) {
      setEditingTaskId("");
      setTaskForm(defaultTaskForm());
    }
    setMessage("Task deleted");
  }

  async function updateTaskStatus(taskId, status) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadTasks(selectedProjectId);
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter !== "ALL" && task.status !== statusFilter) return false;
      if (priorityFilter !== "ALL" && task.priority !== priorityFilter) return false;

      if (search.trim()) {
        const taskTagNames = (task.tags || []).map((item) => item.tag?.name || "").join(" ");
        const blob = `${task.title} ${task.description || ""} ${task.assignee?.name || ""} ${taskTagNames}`.toLowerCase();
        if (!blob.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, search]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <h1>Stride PM</h1>
          <p>{user?.name || user?.email}</p>
        </div>

        <button className="sidebar-btn sidebar-signout" onClick={() => signOut({ callbackUrl: "/login" })}>
          Sign out
        </button>

        <section className="sidebar-section">
          <h2>Projects</h2>
          <div className="project-list">
            {projects.map((project) => (
              <button
                key={project.id}
                className={`sidebar-project-btn ${selectedProjectId === project.id ? "active" : ""}`}
                onClick={() => setSelectedProjectId(project.id)}
              >
                {project.name}
              </button>
            ))}
          </div>
          <form onSubmit={createProject} className="row-form">
            <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="New project" required />
            <button type="submit">Add</button>
          </form>
        </section>

        <section className="sidebar-section">
          <h2>Members</h2>
          <ul className="member-list">
            {members.map((member) => (
              <li key={member.user.id}>{member.user.name || member.user.email}</li>
            ))}
          </ul>
          <form onSubmit={addMember} className="row-form">
            <input value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} placeholder="teammate@email.com" />
            <button type="submit">Invite</button>
          </form>
        </section>

        <section className="sidebar-section">
          <h2>Tags</h2>
          <div className="tag-cloud">
            {tags.map((tag) => (
              <span key={tag.id} className="task-tag" style={{ backgroundColor: `${tag.color}22`, borderColor: tag.color }}>
                <i style={{ backgroundColor: tag.color }} />
                {tag.name}
              </span>
            ))}
            {!tags.length ? <small>No tags yet</small> : null}
          </div>
          <form onSubmit={createTag} className="tag-form">
            <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Tag name" required />
            <div className="tag-form-row">
              <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} />
              <button type="submit">Create</button>
            </div>
          </form>
        </section>
      </aside>

      <section className="main-panel">
        <header className="top-row">
          <div>
            <h2>{selectedProject?.name || "No project selected"}</h2>
            <p>Team workspace with live PostgreSQL-backed data</p>
          </div>
          <div className="top-actions">
            <button className="primary-btn" onClick={startCreateTask}>New Task</button>
            <div className="view-tabs">
              {VIEW_OPTIONS.map((value) => (
                <button key={value} className={view === value ? "active" : ""} onClick={() => setView(value)}>
                  {capitalize(value)}
                </button>
              ))}
            </div>
          </div>
        </header>

        <section className="filters">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All status</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="ALL">All priority</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </section>

        {message ? <div className="ok-box">{message}</div> : null}
        {error ? <div className="error-box">{error}</div> : null}

        <section>
          <div className="card">
            {view === "kanban" ? renderKanban(filteredTasks, startEditTask, deleteTask, updateTaskStatus) : null}
            {view === "timeline" ? renderTimeline(filteredTasks, startEditTask, deleteTask) : null}
            {view === "list" ? renderList(filteredTasks, startEditTask, deleteTask) : null}
            {view === "calendar" ? renderCalendar(filteredTasks, startEditTask) : null}
          </div>
        </section>
      </section>

      {isTaskModalOpen ? (
        <div className="modal-overlay" onClick={closeTaskModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <h3>{editingTaskId ? "Update Task" : "Create Task"}</h3>
              <button className="ghost-btn" onClick={closeTaskModal}>Close</button>
            </div>
            <form className="form-card modal-form" onSubmit={saveTask}>
              <input
                placeholder="Title"
                value={taskForm.title}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
              <textarea
                placeholder="Description"
                value={taskForm.description}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <div className="row-2">
                <select
                  value={taskForm.status}
                  onChange={(e) => setTaskForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                </select>
                <select
                  value={taskForm.priority}
                  onChange={(e) => setTaskForm((prev) => ({ ...prev, priority: e.target.value }))}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
              <div className="row-2">
                <select
                  value={taskForm.assigneeId}
                  onChange={(e) => setTaskForm((prev) => ({ ...prev, assigneeId: e.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {member.user.name || member.user.email}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  aria-label="Start date"
                  value={taskForm.startDate}
                  onChange={(e) => setTaskForm((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="row-2">
                <input
                  type="date"
                  aria-label="End date"
                  value={taskForm.endDate}
                  onChange={(e) => setTaskForm((prev) => ({ ...prev, endDate: e.target.value }))}
                />
                <div className="task-tag-picker">
                  {tags.map((tag) => (
                    <label key={tag.id} className="tag-option">
                      <input
                        type="checkbox"
                        checked={taskForm.tagIds.includes(tag.id)}
                        onChange={() =>
                          setTaskForm((prev) => ({
                            ...prev,
                            tagIds: prev.tagIds.includes(tag.id)
                              ? prev.tagIds.filter((id) => id !== tag.id)
                              : [...prev.tagIds, tag.id],
                          }))
                        }
                      />
                      <span className="task-tag" style={{ backgroundColor: `${tag.color}22`, borderColor: tag.color }}>
                        <i style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </span>
                    </label>
                  ))}
                  {!tags.length ? <small>Create tags in the sidebar first.</small> : null}
                </div>
              </div>
              <div className="row-actions">
                <button type="submit">{editingTaskId ? "Update Task" : "Create Task"}</button>
                <button type="button" className="ghost-btn" onClick={closeTaskModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function renderKanban(tasks, onEdit, onDelete, onDropStatus) {
  return (
    <div className="kanban-grid">
      {STATUS_COLUMNS.map((column) => (
        <div
          key={column.key}
          className="kanban-column"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData("text/task-id");
            if (id) onDropStatus(id, column.key);
          }}
        >
          <h4>{column.label}</h4>
          {tasks
            .filter((task) => task.status === column.key)
            .map((task) => (
              <TaskCard key={task.id} task={task} onEdit={() => onEdit(task)} onDelete={() => onDelete(task.id)} draggable />
            ))}
        </div>
      ))}
    </div>
  );
}

function renderTimeline(tasks, onEdit, onDelete) {
  const timelineTasks = tasks.map((task) => {
    const start = startOfDay(task.startDate || task.createdAt || new Date());
    const rawEnd = task.endDate ? startOfDay(task.endDate) : addDays(start, 3);
    const end = rawEnd < start ? start : rawEnd;
    return { task, start, end };
  });

  if (!timelineTasks.length) return <p>No tasks</p>;

  const minStart = new Date(Math.min(...timelineTasks.map((item) => item.start.getTime())));
  const maxEnd = new Date(Math.max(...timelineTasks.map((item) => item.end.getTime())));

  const rangeStart = addDays(minStart, -1);
  const rangeEnd = addDays(maxEnd, 1);
  const totalDays = Math.max(7, daysBetween(rangeStart, rangeEnd) + 1);
  const days = Array.from({ length: totalDays }, (_, index) => addDays(rangeStart, index));

  return (
    <div className="gantt-wrap">
      <div className="gantt-scroll">
        <div className="gantt-header">
          <div className="gantt-task-col">Task</div>
          <div className="gantt-days">
            {days.map((day) => (
              <div key={day.toISOString()} className="gantt-day">
                {day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
            ))}
          </div>
        </div>

        {timelineTasks
          .sort((a, b) => a.start.getTime() - b.start.getTime())
          .map(({ task, start, end }) => {
            const offset = daysBetween(rangeStart, start);
            const span = daysBetween(start, end) + 1;
            const leftPct = (offset / totalDays) * 100;
            const widthPct = Math.max((span / totalDays) * 100, 2);

            return (
              <div key={task.id} className="gantt-row">
                <div className="gantt-task-col">
                  <button className="link-btn" onClick={() => onEdit(task)}>{task.title}</button>
                  <small>{task.assignee?.name || task.assignee?.email || "Unassigned"}</small>
                  <small>{humanStatus(task.status)} • {capitalize(task.priority.toLowerCase())} • {dateRangeLabel(task)}</small>
                  <div className="tag-cloud">
                    {taskTags(task).map((tag) => (
                      <span key={tag.id} className="task-tag" style={{ backgroundColor: `${tag.color}22`, borderColor: tag.color }}>
                        <i style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </span>
                    ))}
                  </div>
                  <button className="danger link-btn" onClick={() => onDelete(task.id)}>Delete</button>
                </div>
                <div className="gantt-track">
                  <button
                    className={`gantt-bar ${task.priority.toLowerCase()}`}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    onClick={() => onEdit(task)}
                    title={`${task.title} (${shortDate(start)} - ${shortDate(end)})`}
                  >
                    {task.title}
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function renderList(tasks, onEdit, onDelete) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Assignee</th>
            <th>Start</th>
            <th>End</th>
            <th>Tags</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>{task.title}</td>
              <td>{humanStatus(task.status)}</td>
              <td>{capitalize(task.priority.toLowerCase())}</td>
              <td>{task.assignee?.name || task.assignee?.email || "-"}</td>
              <td>{shortDate(task.startDate)}</td>
              <td>{shortDate(task.endDate)}</td>
              <td>
                <div className="tag-cloud">
                  {taskTags(task).map((tag) => (
                    <span key={tag.id} className="task-tag" style={{ backgroundColor: `${tag.color}22`, borderColor: tag.color }}>
                      <i style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </span>
                  ))}
                </div>
              </td>
              <td>
                <button onClick={() => onEdit(task)}>Edit</button>
                <button className="danger" onClick={() => onDelete(task.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!tasks.length ? <p>No tasks</p> : null}
    </div>
  );
}

function renderCalendar(tasks, onEdit) {
  const days = [];
  const start = new Date();

  for (let i = 0; i < 14; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }

  return (
    <div className="calendar-grid">
      {days.map((day) => {
        const key = day.toISOString().slice(0, 10);
        const dayTasks = tasks.filter((task) => task.startDate && String(task.startDate).slice(0, 10) === key);

        return (
          <div key={key} className="calendar-cell">
            <strong>{day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</strong>
            {dayTasks.map((task) => (
              <button key={task.id} className="calendar-task" onClick={() => onEdit(task)}>
                {task.title}
              </button>
            ))}
            {!dayTasks.length ? <small>No tasks</small> : null}
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({ task, onEdit, onDelete, draggable = false }) {
  return (
    <article
      className="task-card"
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/task-id", task.id)}
    >
      <h5>{task.title}</h5>
      <p>{task.description || "No description"}</p>
      <small>{task.assignee?.name || task.assignee?.email || "Unassigned"}</small>
      <small>{dateRangeLabel(task)}</small>
      <div className="tag-cloud">
        {taskTags(task).map((tag) => (
          <span key={tag.id} className="task-tag" style={{ backgroundColor: `${tag.color}22`, borderColor: tag.color }}>
            <i style={{ backgroundColor: tag.color }} />
            {tag.name}
          </span>
        ))}
      </div>
      <div className="row-actions">
        <button onClick={onEdit}>Edit</button>
        <button className="danger" onClick={onDelete}>Delete</button>
      </div>
    </article>
  );
}

function TaskRow({ task, onEdit, onDelete }) {
  return (
    <div className="task-row">
      <div>
        <strong>{task.title}</strong>
        <p>{task.description || "No description"}</p>
      </div>
      <div>
        <span>{humanStatus(task.status)}</span>
        <span>{capitalize(task.priority.toLowerCase())}</span>
        <span>{task.assignee?.name || task.assignee?.email || "Unassigned"}</span>
        <span>{dateRangeLabel(task)}</span>
        <div className="tag-cloud">
          {taskTags(task).map((tag) => (
            <span key={tag.id} className="task-tag" style={{ backgroundColor: `${tag.color}22`, borderColor: tag.color }}>
              <i style={{ backgroundColor: tag.color }} />
              {tag.name}
            </span>
          ))}
        </div>
      </div>
      <div className="row-actions">
        <button onClick={onEdit}>Edit</button>
        <button className="danger" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

function defaultTaskForm() {
  return {
    title: "",
    description: "",
    status: "TODO",
    priority: "MEDIUM",
    assigneeId: "",
    startDate: "",
    endDate: "",
    tagIds: [],
  };
}

function shortDate(value) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString();
}

function toDate(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const date = new Date(value).getTime();
  return Number.isNaN(date) ? Number.MAX_SAFE_INTEGER : date;
}

function dateRangeLabel(task) {
  const start = shortDate(task.startDate);
  const end = shortDate(task.endDate);
  if (!task.startDate && !task.endDate) return "No dates";
  if (!task.startDate) return `Ends: ${end}`;
  if (!task.endDate) return `Starts: ${start}`;
  return `${start} -> ${end}`;
}

function taskTags(task) {
  return (task.tags || []).map((item) => item.tag).filter(Boolean);
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return startOfDay(date);
}

function daysBetween(start, end) {
  const ms = startOfDay(end).getTime() - startOfDay(start).getTime();
  return Math.round(ms / 86400000);
}

function humanStatus(status) {
  if (status === "TODO") return "To Do";
  if (status === "IN_PROGRESS") return "In Progress";
  if (status === "DONE") return "Done";
  return status;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
